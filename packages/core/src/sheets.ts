import { customLabelSchema, labelColorSchema, type CustomLabel } from './labels'
import {
  BODY_MAX_LENGTH,
  NOTE_COLORS,
  NOTE_SOURCES,
  NOTE_STATUSES,
  clampBody,
  clampTitle,
  noteSchema,
  type Note,
  type NoteColor,
  type NoteSource,
  type NoteStatus,
} from './note'
import { projectSchema, type Project } from './project'
import { SCHEMA_VERSION } from './constants'

/**
 * The spreadsheet layout and the conversion between sheet rows and app objects.
 * Both the website and the MCP server read and write rows through this module,
 * so the data format stays the same everywhere.
 */

/** A cell as the Sheets API returns it with `valueRenderOption=UNFORMATTED_VALUE`. */
export type Cell = string | number | boolean

export type SpreadsheetKind = 'home' | 'project'
export type SheetName = 'meta' | 'notes' | 'labels' | 'projects'

/** Drive `appProperties` key that marks DevNotes files: `devnotes=home|project|folder`. */
export const APP_PROPERTY_KEY = 'devnotes'
export const HOME_SPREADSHEET_TITLE = 'DevNotes'
/** The folder in the root of My Drive that holds the spreadsheets the app creates. */
export const FOLDER_TITLE = 'DevNotes'
/**
 * `appProperties` key on the home spreadsheet: set once the spreadsheets that were
 * created in the root of My Drive have been moved into the folder, so that a
 * spreadsheet the user moves later is never moved back.
 */
export const FOLDER_MOVED_KEY = 'devnotes_folder_moved'

export function projectSpreadsheetTitle(projectName: string): string {
  return `DevNotes — ${projectName}`
}

export const NOTE_COLUMNS = [
  'id',
  'title',
  'body',
  'status',
  'labels',
  'color',
  'pinned',
  'archived',
  'solution',
  'source',
  'review',
  'created_at',
  'updated_at',
  'deleted',
] as const
export const LABEL_COLUMNS = ['name', 'color', 'created_at'] as const
export const PROJECT_COLUMNS = [
  'id',
  'name',
  'spreadsheet_id',
  'role',
  'order',
  'added_at',
  'removed',
] as const
export const META_COLUMNS = ['key', 'value'] as const

export const SHEET_COLUMNS: Record<SheetName, readonly string[]> = {
  meta: META_COLUMNS,
  notes: NOTE_COLUMNS,
  labels: LABEL_COLUMNS,
  projects: PROJECT_COLUMNS,
}

/** The column that identifies a row of each sheet. */
export const KEY_COLUMN: Record<SheetName, string> = {
  meta: 'key',
  notes: 'id',
  labels: 'name',
  projects: 'id',
}

export function sheetsOf(kind: SpreadsheetKind): SheetName[] {
  return kind === 'home' ? ['meta', 'notes', 'labels', 'projects'] : ['meta', 'notes', 'labels']
}

/** Rows of the `meta` sheet below the header. */
export function metaRows(kind: SpreadsheetKind, name: string): Cell[][] {
  return [
    ['schema_version', SCHEMA_VERSION],
    ['kind', kind],
    ['name', name],
  ]
}

export function readMeta(rows: readonly (readonly Cell[])[]): Map<string, string> {
  const header = readHeader(rows[0])
  const meta = new Map<string, string>()
  for (const row of rows.slice(1)) {
    const key = text(cellAt(row, header, 'key'))
    if (key !== '') meta.set(key, text(cellAt(row, header, 'value')))
  }
  return meta
}

// ---------------------------------------------------------------------------
// Headers and records

/** Column name → zero-based column index. Columns are found by name, never by position. */
export type Header = ReadonlyMap<string, number>

export function readHeader(row: readonly Cell[] | undefined): Header {
  const header = new Map<string, number>()
  row?.forEach((cell, index) => {
    const name = text(cell).trim()
    if (name !== '' && !header.has(name)) header.set(name, index)
  })
  return header
}

/** A row as named values. Columns that are not in the record are left untouched on write. */
export type RowRecord = Readonly<Record<string, Cell>>

export function cellAt(row: readonly Cell[], header: Header, column: string): Cell | undefined {
  const index = header.get(column)
  return index === undefined ? undefined : row[index]
}

/** A full row for a new line: known columns in the header's order, the rest empty. */
export function recordToRow(record: RowRecord, header: Header): Cell[] {
  const width = Math.max(-1, ...header.values()) + 1
  const row: Cell[] = Array.from({ length: width }, () => '')
  for (const [column, index] of header) {
    const value = record[column]
    if (value !== undefined) row[index] = value
  }
  return row
}

export interface RowSegment {
  /** Zero-based index of the first column. */
  startColumn: number
  values: Cell[]
}

/**
 * The cells of a record grouped into runs of adjacent columns. Writing segments
 * instead of a whole row keeps columns the user added by hand intact.
 */
export function recordToSegments(record: RowRecord, header: Header): RowSegment[] {
  const cells = [...header]
    .flatMap(([column, index]) => {
      const value = record[column]
      return value === undefined ? [] : [{ index, value }]
    })
    .toSorted((a, b) => a.index - b.index)

  const segments: RowSegment[] = []
  for (const cell of cells) {
    const last = segments.at(-1)
    if (last && last.startColumn + last.values.length === cell.index) last.values.push(cell.value)
    else segments.push({ startColumn: cell.index, values: [cell.value] })
  }
  return segments
}

// ---------------------------------------------------------------------------
// Cell parsing

function text(cell: Cell | undefined): string {
  if (cell === undefined) return ''
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE'
  return String(cell)
}

function flag(cell: Cell | undefined): boolean {
  if (typeof cell === 'boolean') return cell
  return text(cell).trim().toUpperCase() === 'TRUE'
}

function oneOf<T extends string>(values: readonly T[], cell: Cell | undefined, fallback: T): T {
  const value = text(cell).trim()
  return (values as readonly string[]).includes(value) ? (value as T) : fallback
}

const EPOCH = '1970-01-01T00:00:00.000Z'

function timestamp(cell: Cell | undefined): string | null {
  const value = text(cell).trim()
  if (value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function labelList(cell: Cell | undefined): string[] {
  const value = text(cell).trim()
  if (value === '') return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item !== '')
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Notes

/** `ai`, written by early versions, means an AI answer pasted on the site. */
function sourceFromCell(cell: Cell | undefined): NoteSource {
  const value = text(cell).trim()
  if (value === 'ai') return 'ai_paste'
  return oneOf<NoteSource>(NOTE_SOURCES, value, 'user')
}

export function noteToRecord(note: Note): RowRecord {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    status: note.status,
    labels: JSON.stringify(note.labels),
    color: note.color,
    pinned: note.pinned,
    archived: note.archived,
    solution: note.solution,
    source: note.source,
    review: note.review ?? '',
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    deleted: note.deleted,
  }
}

/**
 * Reads a note row. The project is not a column: it is the spreadsheet the row
 * lives in. Rows without an id are skipped (`null`); other odd values are
 * replaced with defaults, since people can edit the sheet by hand.
 */
export function rowToNote(
  row: readonly Cell[],
  header: Header,
  projectId: string | null,
): Note | null {
  const get = (column: string) => cellAt(row, header, column)
  const id = text(get('id')).trim()
  if (id === '') return null

  const updatedAt = timestamp(get('updated_at')) ?? timestamp(get('created_at')) ?? EPOCH
  const note: Note = {
    id,
    title: clampTitle(text(get('title'))),
    body: clampBody(text(get('body'))),
    status: oneOf<NoteStatus>(NOTE_STATUSES, get('status'), 'new'),
    labels: labelList(get('labels')),
    color: oneOf<NoteColor>(NOTE_COLORS, get('color'), 'default'),
    pinned: flag(get('pinned')),
    archived: flag(get('archived')),
    solution: text(get('solution')).slice(0, BODY_MAX_LENGTH),
    source: sourceFromCell(get('source')),
    review: text(get('review')).trim() === 'pending' ? 'pending' : null,
    createdAt: timestamp(get('created_at')) ?? updatedAt,
    updatedAt,
    deleted: flag(get('deleted')),
    projectId,
  }
  return noteSchema.safeParse(note).success ? note : null
}

// ---------------------------------------------------------------------------
// Labels

export function labelToRecord(label: CustomLabel): RowRecord {
  return { name: label.name, color: label.color, created_at: label.createdAt }
}

export function rowToLabel(row: readonly Cell[], header: Header): CustomLabel | null {
  const color = labelColorSchema.safeParse(text(cellAt(row, header, 'color')).trim())
  const label = {
    name: text(cellAt(row, header, 'name')).trim(),
    color: color.success ? color.data : 'gray',
    createdAt: timestamp(cellAt(row, header, 'created_at')) ?? EPOCH,
  }
  const parsed = customLabelSchema.safeParse(label)
  return parsed.success ? parsed.data : null
}

// ---------------------------------------------------------------------------
// Projects

export function projectToRecord(project: Project): RowRecord {
  return {
    id: project.id,
    name: project.name,
    spreadsheet_id: project.spreadsheetId,
    role: project.role,
    order: project.order,
    added_at: project.addedAt,
    removed: project.removed,
  }
}

export function rowToProject(row: readonly Cell[], header: Header): Project | null {
  const get = (column: string) => cellAt(row, header, column)
  const order = Number(text(get('order')))
  const project = {
    id: text(get('id')).trim(),
    name: text(get('name')).trim(),
    spreadsheetId: text(get('spreadsheet_id')).trim(),
    role: text(get('role')).trim() === 'member' ? 'member' : 'owner',
    order: Number.isInteger(order) ? order : 0,
    addedAt: timestamp(get('added_at')) ?? EPOCH,
    removed: flag(get('removed')),
  }
  const parsed = projectSchema.safeParse(project)
  return parsed.success && parsed.data.spreadsheetId !== '' ? parsed.data : null
}

// ---------------------------------------------------------------------------
// A1 notation

/** Zero-based column index → column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let letters = ''
  let n = index + 1
  while (n > 0) {
    const rest = (n - 1) % 26
    letters = String.fromCharCode(65 + rest) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

/**
 * First and last row of an A1 range such as `notes!A5:N7` or `'notes'!A5`.
 * Used to learn where `values.append` put new rows (`updatedRange`).
 */
export function rangeRows(range: string): { first: number; last: number } | null {
  const cells = range.slice(range.lastIndexOf('!') + 1)
  const match = /^[A-Z]*(\d+)(?::[A-Z]*(\d+))?$/i.exec(cells)
  if (!match?.[1]) return null
  const first = Number(match[1])
  return { first, last: match[2] ? Number(match[2]) : first }
}
