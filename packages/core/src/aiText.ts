import { BUG_LABEL, IDEA_LABEL } from './bugs'
import { hasLabel } from './labels'
import type { Note } from './note'

/** A note for the "Copy for AI" text, with the name of its project. */
export interface AiTextItem {
  note: Note
  projectName: string
}

type Kind = 'bug' | 'idea' | 'other'

const HEADING: Record<Kind, string> = { bug: 'БАГ', idea: 'ИДЕЯ', other: 'ЗАМЕТКА' }

/** Russian plural: 1 баг, 2 бага, 5 багов. */
export function pluralRu(count: number, one: string, few: string, many: string): string {
  const tens = count % 100
  const units = count % 10
  if (tens >= 11 && tens <= 14) return many
  if (units === 1) return one
  if (units >= 2 && units <= 4) return few
  return many
}

function kindOf(note: Note): Kind {
  if (hasLabel(note.labels, BUG_LABEL)) return 'bug'
  if (hasLabel(note.labels, IDEA_LABEL)) return 'idea'
  return 'other'
}

function joinRu(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} и ${parts.at(-1) ?? ''}`
}

/**
 * The text "for AI": a project line, a summary ("Нужно исправить 2 бага и оценить
 * 1 идею."), then the notes — bugs first, then ideas, then the rest. Each has a
 * heading such as "БАГ 1. …" (no number when it is the only one of its kind),
 * its text and, if there is one, the line "Как починил: …".
 */
export function buildAiText(items: readonly AiTextItem[]): string {
  if (items.length === 0) return ''

  const groups: Record<Kind, AiTextItem[]> = { bug: [], idea: [], other: [] }
  for (const item of items) groups[kindOf(item.note)].push(item)

  const projects = [...new Set(items.map((item) => item.projectName))]
  const projectLine = `${projects.length > 1 ? 'Проекты' : 'Проект'}: ${projects.join(', ')}`

  const tasks: string[] = []
  const bugs = groups.bug.length
  const ideas = groups.idea.length
  const others = groups.other.length
  if (bugs > 0) tasks.push(`исправить ${String(bugs)} ${pluralRu(bugs, 'баг', 'бага', 'багов')}`)
  if (ideas > 0) tasks.push(`оценить ${String(ideas)} ${pluralRu(ideas, 'идею', 'идеи', 'идей')}`)
  if (others > 0) {
    tasks.push(`разобрать ${String(others)} ${pluralRu(others, 'заметку', 'заметки', 'заметок')}`)
  }

  const blocks = (['bug', 'idea', 'other'] as const).flatMap((kind) =>
    groups[kind].map(({ note }, index) => {
      const number = groups[kind].length > 1 ? ` ${String(index + 1)}` : ''
      const title = note.title.trim() === '' ? 'Без названия' : note.title.trim()
      const lines = [`${HEADING[kind]}${number}. ${title}`]
      if (note.body.trim() !== '') lines.push(note.body.trim())
      if (note.solution.trim() !== '') lines.push(`Как починил: ${note.solution.trim()}`)
      return lines.join('\n')
    }),
  )

  return [`${projectLine}\nНужно ${joinRu(tasks)}.`, ...blocks].join('\n\n')
}
