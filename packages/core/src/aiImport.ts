import { z } from 'zod'
import { BUILTIN_LABELS, LABEL_NAME_MAX_LENGTH, labelKey, type Label } from './labels'
import { BODY_MAX_LENGTH, NOTE_STATUSES, TITLE_MAX_LENGTH, type NoteStatus } from './note'

/** Format version the AI is asked to put into `devnotes`. */
export const AI_IMPORT_VERSION = 1
/** At most this many cards come from one paste. */
export const AI_IMPORT_MAX_NOTES = 100
/** At most this many labels that do not exist yet are created by one paste. */
export const AI_IMPORT_MAX_NEW_LABELS = 10

/**
 * One card as the AI may write it. Only `title` is required; anything odd in the
 * other fields is replaced with a default instead of rejecting the card.
 */
export const aiImportNoteSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().catch(''),
  labels: z.array(z.unknown()).catch([]),
  status: z.unknown().optional(),
  solution: z.string().catch(''),
})

export const aiImportSchema = z.object({
  devnotes: z.unknown().optional(),
  notes: z.array(z.unknown()),
})

/** A card ready to be saved for review. */
export interface AiImportNote {
  title: string
  body: string
  labels: string[]
  status: NoteStatus
  solution: string
}

export type AiImportError =
  /** No JSON in the text at all. */
  | 'noJson'
  /** Something looks like JSON but cannot be read. */
  | 'invalidJson'
  /** The JSON has no `notes` list, or none of the cards has a title. */
  | 'noNotes'

export interface AiImport {
  notes: AiImportNote[]
  /** Labels that do not exist yet and will be created, in order of appearance. */
  newLabels: string[]
  /** Labels over the limit of new ones; they are removed from the cards. */
  droppedLabels: string[]
  /** Cards without a title. */
  skipped: number
  /** Cards over the limit of one paste; they are not added. */
  overLimit: number
}

export type AiImportResult = AiImport | { error: AiImportError }

const FENCED_JSON = /```json[^\n]*\n([\s\S]*?)```/i

/** The first `{ … }` with balanced braces, skipping braces inside strings. */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return text.slice(start)
}

/** The JSON of an AI answer: the first ```json block, otherwise the first JSON object. */
export function extractJson(text: string): string | null {
  const fenced = FENCED_JSON.exec(text)
  if (fenced?.[1] !== undefined) return fenced[1].trim()
  return firstJsonObject(text)
}

/**
 * Turns an AI answer into cards. Existing labels are matched by name without
 * regard to case (built-in ones also by `bug`, `idea`, `fix`); unknown statuses
 * become `new`; text is cut to the usual limits.
 */
export function parseAiImport(text: string, labels: readonly Label[]): AiImportResult {
  const json = extractJson(text)
  if (json === null) return { error: 'noJson' }

  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { error: 'invalidJson' }
  }
  const root = aiImportSchema.safeParse(data)
  if (!root.success) return { error: 'noNotes' }

  const known = new Map<string, string>()
  for (const label of labels) known.set(labelKey(label.name), label.name)
  for (const builtin of BUILTIN_LABELS) {
    for (const alias of builtin.aliases) known.set(alias, builtin.name)
  }

  const newLabels: string[] = []
  const dropped: string[] = []
  const resolveLabel = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null
    const name = raw.trim().slice(0, LABEL_NAME_MAX_LENGTH)
    if (name === '') return null
    const key = labelKey(name)
    const existing = known.get(key)
    if (existing !== undefined) return existing
    if (newLabels.length < AI_IMPORT_MAX_NEW_LABELS) {
      newLabels.push(name)
      known.set(key, name)
      return name
    }
    if (!dropped.some((other) => labelKey(other) === key)) dropped.push(name)
    return null
  }

  let skipped = 0
  const cards = root.data.notes
  const notes: AiImportNote[] = []
  for (const raw of cards.slice(0, AI_IMPORT_MAX_NOTES)) {
    const card = aiImportNoteSchema.safeParse(raw)
    if (!card.success) {
      skipped += 1
      continue
    }
    const names: string[] = []
    for (const rawLabel of card.data.labels) {
      const name = resolveLabel(rawLabel)
      if (name !== null && !names.some((other) => labelKey(other) === labelKey(name))) {
        names.push(name)
      }
    }
    const status = (NOTE_STATUSES as readonly unknown[]).includes(card.data.status)
      ? (card.data.status as NoteStatus)
      : 'new'
    notes.push({
      title: card.data.title.slice(0, TITLE_MAX_LENGTH),
      body: card.data.body.trim().slice(0, BODY_MAX_LENGTH),
      labels: names,
      status,
      solution: card.data.solution.trim().slice(0, BODY_MAX_LENGTH),
    })
  }

  if (notes.length === 0) return { error: 'noNotes' }
  return {
    notes,
    newLabels,
    droppedLabels: dropped,
    skipped,
    overLimit: Math.max(0, cards.length - AI_IMPORT_MAX_NOTES),
  }
}

/**
 * The instruction the user adds to a request to any AI, so that it answers in
 * the format `parseAiImport` reads.
 */
export const AI_INSTRUCTION = `Оформи результат как карточки для приложения DevNotes.

Ответь блоком кода json в таком формате:

\`\`\`json
{
  "devnotes": ${String(AI_IMPORT_VERSION)},
  "notes": [
    {
      "title": "Меню паузы не закрывается с геймпада",
      "body": "Что случилось: ...\\nКак повторить: ...\\nОжидалось: ...",
      "labels": ["Баг"],
      "status": "new",
      "solution": ""
    }
  ]
}
\`\`\`

Правила:
- Одна карточка — одна задача: баг, идея или другое дело.
- "title" — короткий заголовок, до ${String(TITLE_MAX_LENGTH)} символов. Обязателен.
- "body" — подробности обычным текстом, без разметки. Переносы строк — \\n. Для бага пиши три строки: «Что случилось:», «Как повторить:», «Ожидалось:».
- "labels" — метки: «Баг», «Идея» или «Фикс». Можно свои, но не больше ${String(AI_IMPORT_MAX_NEW_LABELS)} новых.
- "status" — "new" (новое), "wip" (в разработке) или "done" (готово). Если не знаешь — "new".
- "solution" — как исправили, если баг уже исправлен. Иначе пустая строка.
- Не больше ${String(AI_IMPORT_MAX_NOTES)} карточек.`
