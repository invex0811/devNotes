import { z } from 'zod'

export const TITLE_MAX_LENGTH = 200
export const BODY_MAX_LENGTH = 20_000

/** Note statuses exactly as they are written to the `status` column. */
export const NOTE_STATUSES = ['new', 'wip', 'done'] as const
export const NOTE_COLORS = ['default', 'red', 'violet', 'green', 'yellow'] as const
/** Who created the note: the user, an AI answer pasted on the site, or the MCP server. */
export const NOTE_SOURCES = ['user', 'ai_paste', 'ai_mcp'] as const

export const noteStatusSchema = z.enum(NOTE_STATUSES)
export const noteColorSchema = z.enum(NOTE_COLORS)
export const noteSourceSchema = z.enum(NOTE_SOURCES)

export type NoteStatus = z.infer<typeof noteStatusSchema>
export type NoteColor = z.infer<typeof noteColorSchema>
export type NoteSource = z.infer<typeof noteSourceSchema>

export const noteSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(TITLE_MAX_LENGTH),
  body: z.string().max(BODY_MAX_LENGTH),
  status: noteStatusSchema,
  /** Label names; labels are matched by name, case-insensitively. */
  labels: z.array(z.string().min(1)),
  color: noteColorSchema,
  pinned: z.boolean(),
  archived: z.boolean(),
  /** Text of the "how I fixed it" field. */
  solution: z.string().max(BODY_MAX_LENGTH),
  source: noteSourceSchema,
  /** `pending` while an AI-created card waits for the user's review. */
  review: z.literal('pending').nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Soft delete: rows are never removed from the sheet. */
  deleted: z.boolean(),
  /**
   * Not a sheet column: the project is defined by the spreadsheet the row lives in.
   * `null` means "no project" (the user's home spreadsheet).
   */
  projectId: z.string().min(1).nullable(),
})

export type Note = z.infer<typeof noteSchema>

export type NotePatch = Partial<
  Pick<
    Note,
    | 'title'
    | 'body'
    | 'status'
    | 'labels'
    | 'color'
    | 'pinned'
    | 'archived'
    | 'solution'
    | 'review'
    | 'deleted'
    | 'projectId'
  >
>

export interface NewNoteInput {
  id: string
  /** Current time, ISO 8601 in UTC. */
  now: string
  title: string
  projectId: string | null
  labels?: readonly string[]
}

export function clampTitle(title: string): string {
  return title.slice(0, TITLE_MAX_LENGTH)
}

export function clampBody(body: string): string {
  return body.slice(0, BODY_MAX_LENGTH)
}

/** A note as the user creates it: status "new", no text, default color. */
export function createNote(input: NewNoteInput): Note {
  return {
    id: input.id,
    title: clampTitle(input.title),
    body: '',
    status: 'new',
    labels: [...(input.labels ?? [])],
    color: 'default',
    pinned: false,
    archived: false,
    solution: '',
    source: 'user',
    review: null,
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    projectId: input.projectId,
  }
}

/** Returns a changed copy of the note with `updatedAt` set and text limits enforced. */
export function applyNotePatch(note: Note, patch: NotePatch, now: string): Note {
  const next: Note = { ...note, ...patch, updatedAt: now }
  next.title = clampTitle(next.title)
  next.body = clampBody(next.body)
  next.solution = clampBody(next.solution)
  return next
}

/** Clicking a status badge moves the note around the circle new → wip → done → new. */
export function nextStatus(status: NoteStatus): NoteStatus {
  const index = NOTE_STATUSES.indexOf(status)
  return NOTE_STATUSES[(index + 1) % NOTE_STATUSES.length] ?? 'new'
}
