import {
  LABEL_COLORS,
  NOTE_STATUSES,
  allLabels,
  applyBugRules,
  columnLetter,
  createNote,
  hasLabel,
  labelToRecord,
  noteMatchesQuery,
  noteToRecord,
  normalizeAiNotes,
  readHeader,
  recordToRow,
  recordToSegments,
  rowToLabel,
  rowToNote,
  rowToProject,
  sortNotes,
  type CustomLabel,
  type Header,
  type Note,
  type NoteStatus,
  type Project,
  type RowRecord,
} from '@devnotes/core'
import type { SheetsClient, ValueRange } from './google'

/** The id `list_projects` gives to notes outside projects (the home spreadsheet). */
export const NO_PROJECT_ID = 'none'
export const NO_PROJECT_NAME = 'Без проекта'
export const MAX_CREATE = 50
export const DEFAULT_LIST_LIMIT = 50
export const MAX_LIST_LIMIT = 200

/** A problem the AI client can fix by changing its request. */
export class UserError extends Error {
  override name = 'UserError'
}

export interface ProjectInfo {
  id: string
  name: string
  role: 'owner' | 'member' | null
}

export interface NoteFilters {
  status?: NoteStatus | undefined
  label?: string | undefined
  query?: string | undefined
  limit?: number | undefined
}

export interface NewCard {
  title: string
  body?: string | undefined
  labels?: string[] | undefined
  status?: string | undefined
  solution?: string | undefined
}

export interface NoteChange {
  status?: NoteStatus | undefined
  labels?: string[] | undefined
  solution?: string | undefined
}

interface Located {
  note: Note
  row: number
  header: Header
  spreadsheetId: string
}

/**
 * DevNotes data for the MCP server: reads and writes the same spreadsheets as the
 * website, with the row format from the core package. Every call reads the sheet
 * afresh, so rows re-sorted by hand are found by id, never by an old row number.
 */
export class DevNotesStore {
  private readonly client: SheetsClient
  private readonly now: () => string
  private readonly newId: () => string
  private home: string | null = null

  constructor(client: SheetsClient, options: { now?: () => string; newId?: () => string } = {}) {
    this.client = client
    this.now = options.now ?? (() => new Date().toISOString())
    this.newId = options.newId ?? (() => crypto.randomUUID())
  }

  private async homeId(): Promise<string> {
    this.home ??= await this.client.findHomeSpreadsheet()
    if (!this.home) {
      throw new UserError(
        'No DevNotes home spreadsheet was found for this Google account. Sign in on the DevNotes website once, then try again.',
      )
    }
    return this.home
  }

  private async projects(): Promise<Project[]> {
    const [rows = []] = await this.client.getValues(await this.homeId(), ['projects'])
    const header = readHeader(rows[0])
    return rows
      .slice(1)
      .map((row) => rowToProject(row, header))
      .filter((project): project is Project => project !== null && !project.removed)
      .toSorted((a, b) => a.order - b.order)
  }

  async listProjects(): Promise<ProjectInfo[]> {
    const projects = await this.projects()
    return [
      { id: NO_PROJECT_ID, name: NO_PROJECT_NAME, role: null },
      ...projects.map((project) => ({ id: project.id, name: project.name, role: project.role })),
    ]
  }

  /** The spreadsheet of a project id from `list_projects`. */
  private async spreadsheetOf(
    projectId: string,
  ): Promise<{ id: string; projectId: string | null }> {
    if (projectId === NO_PROJECT_ID) return { id: await this.homeId(), projectId: null }
    const project = (await this.projects()).find((candidate) => candidate.id === projectId)
    if (!project) {
      throw new UserError(
        `Unknown project "${projectId}". Call list_projects to get valid project ids.`,
      )
    }
    return { id: project.spreadsheetId, projectId: project.id }
  }

  private async readNotes(spreadsheetId: string, projectId: string | null): Promise<Located[]> {
    const [rows = []] = await this.client.getValues(spreadsheetId, ['notes'])
    const header = readHeader(rows[0])
    const located: Located[] = []
    rows.forEach((row, index) => {
      if (index === 0) return
      const note = rowToNote(row, header, projectId)
      if (note) located.push({ note, row: index + 1, header, spreadsheetId })
    })
    return located
  }

  private async customLabels(): Promise<CustomLabel[]> {
    const [rows = []] = await this.client.getValues(await this.homeId(), ['labels'])
    const header = readHeader(rows[0])
    return rows
      .slice(1)
      .map((row) => rowToLabel(row, header))
      .filter((label): label is CustomLabel => label !== null)
  }

  /** Notes of a project that are neither archived nor deleted, newest first. */
  async listNotes(projectId: string, filters: NoteFilters = {}): Promise<Note[]> {
    const sheet = await this.spreadsheetOf(projectId)
    const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT)
    const notes = (await this.readNotes(sheet.id, sheet.projectId))
      .map((item) => item.note)
      .filter(
        (note) =>
          !note.deleted &&
          !note.archived &&
          (filters.status === undefined || note.status === filters.status) &&
          (filters.label === undefined || hasLabel(note.labels, filters.label)) &&
          noteMatchesQuery(note, filters.query ?? ''),
      )
    return sortNotes(notes).slice(0, limit)
  }

  /** A note by id; looks in the given project or in every spreadsheet. */
  private async locate(noteId: string, projectId?: string): Promise<Located> {
    const sheets =
      projectId === undefined
        ? [
            { id: await this.homeId(), projectId: null },
            ...(await this.projects()).map((project) => ({
              id: project.spreadsheetId,
              projectId: project.id,
            })),
          ]
        : [await this.spreadsheetOf(projectId)]
    for (const sheet of sheets) {
      const found = (await this.readNotes(sheet.id, sheet.projectId)).find(
        (item) => item.note.id === noteId && !item.note.deleted,
      )
      if (found) return found
    }
    throw new UserError(`No note with id "${noteId}". Use list_notes to find note ids.`)
  }

  async getNote(noteId: string, projectId?: string): Promise<Note> {
    return (await this.locate(noteId, projectId)).note
  }

  /**
   * Labels for new or changed cards: existing ones are matched like on the website,
   * missing ones are added to the home spreadsheet (at most 10 per call).
   */
  private async resolveCards(cards: readonly NewCard[]) {
    const custom = await this.customLabels()
    const result = normalizeAiNotes({ notes: cards }, allLabels(custom))
    if ('error' in result) {
      throw new UserError('Every card needs a non-empty "title".')
    }
    if (result.newLabels.length > 0) {
      const time = this.now()
      const created = result.newLabels.map((name, index): CustomLabel => ({
        name,
        color: LABEL_COLORS[(custom.length + index) % LABEL_COLORS.length] ?? 'gray',
        createdAt: time,
      }))
      const home = await this.homeId()
      const [rows = []] = await this.client.getValues(home, ['labels!1:1'])
      const header = readHeader(rows[0])
      await this.client.appendRows(
        home,
        'labels',
        created.map((label) => recordToRow(labelToRecord(label), header)),
      )
    }
    return result
  }

  /** Creates cards for review: always `source=ai_mcp` and `review=pending`. */
  async createNotes(projectId: string, cards: readonly NewCard[]) {
    if (cards.length === 0) throw new UserError('Pass at least one card in "notes".')
    if (cards.length > MAX_CREATE) {
      throw new UserError(`At most ${String(MAX_CREATE)} cards per call; split the request.`)
    }
    const sheet = await this.spreadsheetOf(projectId)
    const resolved = await this.resolveCards(cards)
    const time = this.now()
    const notes = resolved.notes.map((card) =>
      applyBugRules(null, {
        ...createNote({
          id: this.newId(),
          now: time,
          title: card.title,
          projectId: sheet.projectId,
        }),
        body: card.body,
        labels: card.labels,
        status: card.status,
        solution: card.solution,
        source: 'ai_mcp',
        review: 'pending',
      }),
    )
    const [rows = []] = await this.client.getValues(sheet.id, ['notes!1:1'])
    const header = readHeader(rows[0])
    await this.client.appendRows(
      sheet.id,
      'notes',
      notes.map((note) => recordToRow(noteToRecord(note), header)),
    )
    return {
      notes,
      skipped: resolved.skipped,
      newLabels: resolved.newLabels,
      droppedLabels: resolved.droppedLabels,
    }
  }

  /** Changes status, labels and solution. Title and text are never touched. */
  async updateNote(noteId: string, change: NoteChange, projectId?: string) {
    if (
      change.status === undefined &&
      change.labels === undefined &&
      change.solution === undefined
    ) {
      throw new UserError('Pass at least one of "status", "labels" or "solution".')
    }
    if (change.status !== undefined && !NOTE_STATUSES.includes(change.status)) {
      throw new UserError('"status" must be new, wip or done.')
    }
    const found = await this.locate(noteId, projectId)
    const before = found.note
    let labels = before.labels
    let droppedLabels: string[] = []
    if (change.labels !== undefined) {
      const resolved = await this.resolveCards([
        { title: before.title || '-', labels: change.labels },
      ])
      labels = resolved.notes[0]?.labels ?? []
      droppedLabels = resolved.droppedLabels
    }
    const note = applyBugRules(before, {
      ...before,
      status: change.status ?? before.status,
      labels,
      solution: change.solution ?? before.solution,
      updatedAt: this.now(),
    })

    // Only these columns are written, so an edit of the title or text made on the
    // website at the same time is not overwritten.
    const record = noteToRecord(note)
    const changed: RowRecord = {
      status: record.status ?? note.status,
      labels: record.labels ?? '[]',
      solution: record.solution ?? '',
      updated_at: record.updated_at ?? note.updatedAt,
    }
    const writes: ValueRange[] = recordToSegments(changed, found.header).map((segment) => {
      const from = columnLetter(segment.startColumn)
      const to = columnLetter(segment.startColumn + segment.values.length - 1)
      return {
        range: `notes!${from}${String(found.row)}:${to}${String(found.row)}`,
        values: [segment.values],
      }
    })
    await this.client.writeRanges(found.spreadsheetId, writes)
    return { note, droppedLabels }
  }
}
