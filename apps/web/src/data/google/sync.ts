import {
  KEY_COLUMN,
  columnLetter,
  labelKey,
  readHeader,
  recordToRow,
  recordToSegments,
  rowToLabel,
  rowToNote,
  rowToProject,
  type Cell,
  type CustomLabel,
  type Header,
  type Note,
  type Project,
  type RowRecord,
  type SheetName,
} from '@devnotes/core'
import { AuthError, TransientError, type GoogleApi, type ValueRange } from './api'
import type { CacheDb, QueuedOp } from './cache'

/** What the sync indicator shows. */
export type SyncStatus = 'synced' | 'saving' | 'offline' | 'auth'

export interface SyncEngineOptions {
  api: GoogleApi
  db: CacheDb
  homeSpreadsheetId: string
  /** Edits are sent this long after the last one, so typing becomes one write. */
  debounceMs?: number
  /** Row numbers older than this are re-read before writing: the sheet may be re-sorted. */
  indexMaxAgeMs?: number
  now?: () => number
}

/** Where the rows of one sheet are: key → row number, as of `readAt`. */
interface SheetIndex {
  header: Header
  rows: Map<string, number>
  /** `updated_at` of each note row, for "the last write wins". */
  versions: Map<string, string>
  lastRow: number
  readAt: number
}

const MAX_RETRY_MS = 32_000
const FLUSH_LOCK = 'devnotes-sync'

/** The value that identifies a row: ids as they are, label names case-insensitively. */
function normalizeKey(sheet: SheetName, value: Cell | undefined): string {
  const text = value === undefined ? '' : String(value).trim()
  return sheet === 'labels' ? labelKey(text) : text
}

function recordKey(sheet: SheetName, record: RowRecord): string {
  return normalizeKey(sheet, record[KEY_COLUMN[sheet]])
}

function rowRange(sheet: SheetName, row: number, startColumn: number, width: number): string {
  const from = columnLetter(startColumn)
  const to = columnLetter(startColumn + Math.max(width, 1) - 1)
  return `${sheet}!${from}${String(row)}:${to}${String(row)}`
}

function columnRange(sheet: SheetName, column: number): string {
  const letter = columnLetter(column)
  return `${sheet}!${letter}:${letter}`
}

/** Notes of a spreadsheet; the same id in two sheets means a move: the live copy wins. */
function preferNote(a: Note | undefined, b: Note): boolean {
  if (!a) return true
  if (a.deleted !== b.deleted) return a.deleted
  return b.updatedAt > a.updatedAt
}

/**
 * Keeps the IndexedDB cache and the spreadsheets in step: sends the write
 * queue and reads the spreadsheets back. All work runs one job at a time,
 * and across browser tabs too, so a refresh never sees a half-sent queue.
 */
export class SyncEngine {
  private readonly api: GoogleApi
  private readonly db: CacheDb
  private readonly home: string
  private readonly debounceMs: number
  private readonly indexMaxAgeMs: number
  private readonly now: () => number

  private readonly indexes = new Map<string, SheetIndex>()
  private readonly statusListeners = new Set<(status: SyncStatus) => void>()
  private readonly changeListeners = new Set<() => void>()
  private chain: Promise<unknown> = Promise.resolve()
  private timer: ReturnType<typeof setTimeout> | null = null
  private retryAttempt = 0
  private stopped = false
  status: SyncStatus = 'synced'

  constructor(options: SyncEngineOptions) {
    this.api = options.api
    this.db = options.db
    this.home = options.homeSpreadsheetId
    this.debounceMs = options.debounceMs ?? 800
    this.indexMaxAgeMs = options.indexMaxAgeMs ?? 60_000
    this.now = options.now ?? Date.now
  }

  get homeSpreadsheetId(): string {
    return this.home
  }

  onStatus(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  /** Called after a refresh changed the cache. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  async hasPending(): Promise<boolean> {
    return (await this.db.queue.count()) > 0
  }

  /** Puts writes in the queue (in IndexedDB, so they survive a reload) and schedules sending. */
  async enqueue(ops: readonly Omit<QueuedOp, 'seq'>[]): Promise<void> {
    await this.db.transaction('rw', this.db.queue, async () => {
      for (const op of ops) {
        if (op.coalesce !== null) await this.db.queue.where('coalesce').equals(op.coalesce).delete()
        await this.db.queue.add({ ...op })
      }
    })
    if (this.status === 'auth') return
    this.setStatus('saving')
    this.schedule(this.debounceMs)
  }

  /** Sends the queue now. Never throws: problems end up in `status`. */
  flushNow(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    return this.exclusive(() =>
      this.flush().catch((error: unknown) => {
        console.error('DevNotes: sending the write queue failed', error)
      }),
    )
  }

  /**
   * Reads all spreadsheets (one `values.batchGet` each) and merges them into the
   * cache; with a project id, only that project's spreadsheet (an open shared
   * project is re-read every minute). Throws AuthError or TransientError so
   * callers can tell the user.
   */
  refresh(onlyProjectId?: string): Promise<void> {
    return this.exclusive(async () => {
      try {
        await this.readAll(onlyProjectId)
      } catch (error) {
        this.handleError(error)
        throw error
      }
      if (!(await this.hasPending())) this.setStatus('synced')
    })
  }

  // -------------------------------------------------------------------------

  private setStatus(status: SyncStatus): void {
    if (this.status === status) return
    this.status = status
    for (const listener of this.statusListeners) listener(status)
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flushNow()
    }, delayMs)
  }

  private exclusive<T>(job: () => Promise<T>): Promise<T> {
    const locked = () =>
      typeof navigator !== 'undefined' && 'locks' in navigator
        ? navigator.locks.request(FLUSH_LOCK, job)
        : job()
    const run = this.chain.then(locked, locked)
    this.chain = run.catch(() => undefined)
    return run
  }

  /** Sorts an error into a status; returns true when it is one the engine understands. */
  private handleError(error: unknown): boolean {
    if (error instanceof AuthError) {
      this.setStatus('auth')
      return true
    }
    if (error instanceof TransientError) {
      this.setStatus('offline')
      this.retryAttempt += 1
      const delay = Math.min(2 ** this.retryAttempt * 1000 + Math.random() * 1000, MAX_RETRY_MS)
      this.schedule(delay)
      return true
    }
    return false
  }

  private async flush(): Promise<void> {
    if (this.stopped) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setStatus('offline')
      return
    }
    for (;;) {
      const ops = await this.db.queue.orderBy('seq').toArray()
      if (ops.length === 0) {
        this.retryAttempt = 0
        this.setStatus('synced')
        return
      }
      this.setStatus('saving')

      const groups = new Map<string, QueuedOp[]>()
      for (const op of ops) {
        const group = groups.get(op.spreadsheetId) ?? []
        group.push(op)
        groups.set(op.spreadsheetId, group)
      }

      for (const [spreadsheetId, group] of groups) {
        try {
          await this.send(spreadsheetId, group)
        } catch (error) {
          this.forgetIndexes(spreadsheetId)
          if (this.handleError(error)) return
          // The spreadsheet refuses these writes (deleted, no access, broken layout).
          // Retrying cannot help; drop them so other writes are not stuck behind.
          console.error('DevNotes: dropping writes that Google refused', error)
        }
        await this.db.queue.bulkDelete(group.map((op) => op.seq ?? -1))
      }
    }
  }

  private forgetIndexes(spreadsheetId: string): void {
    for (const key of [...this.indexes.keys()]) {
      if (key.startsWith(`${spreadsheetId}|`)) this.indexes.delete(key)
    }
  }

  /** Sends the ops of one spreadsheet: updates in one batch, new notes in one append. */
  private async send(spreadsheetId: string, ops: readonly QueuedOp[]): Promise<void> {
    const sheets = [...new Set(ops.map((op) => op.sheet))]
    const indexes = new Map<SheetName, SheetIndex>()
    for (const sheet of sheets) {
      // Labels and projects get new rows at a known position, so read them fresh.
      const maxAge = sheet === 'notes' ? this.indexMaxAgeMs : 0
      indexes.set(sheet, await this.index(spreadsheetId, sheet, maxAge))
    }

    const writes: ValueRange[] = []
    const clears: string[] = []
    const appends: { key: string; record: RowRecord }[] = []

    for (const op of ops) {
      const index = indexes.get(op.sheet)
      if (!index) continue
      const width = Math.max(-1, ...index.header.values()) + 1

      if (op.record === null) {
        const row = index.rows.get(op.key)
        if (row !== undefined) clears.push(rowRange(op.sheet, row, 0, width))
        index.rows.delete(op.key)
        continue
      }

      const key = recordKey(op.sheet, op.record)
      if (op.sheet === 'notes') {
        // The last write of a note wins: a newer version in the sheet is kept.
        const remote = index.versions.get(key)
        const local = String(op.record.updated_at ?? '')
        if (remote !== undefined && remote > local) continue
        index.versions.set(key, local)
      }

      const row = index.rows.get(op.key) ?? index.rows.get(key)
      if (row !== undefined) {
        for (const segment of recordToSegments(op.record, index.header)) {
          writes.push({
            range: rowRange(op.sheet, row, segment.startColumn, segment.values.length),
            values: [segment.values],
          })
        }
        index.rows.delete(op.key)
        index.rows.set(key, row)
      } else if (op.sheet === 'notes') {
        if (!appends.some((item) => item.key === key)) appends.push({ key, record: op.record })
      } else {
        index.lastRow += 1
        index.rows.set(key, index.lastRow)
        writes.push({
          range: rowRange(op.sheet, index.lastRow, 0, width),
          values: [recordToRow(op.record, index.header)],
        })
      }
    }

    await this.api.writeRanges(spreadsheetId, writes)
    await this.api.clearRanges(spreadsheetId, clears)

    const notesIndex = indexes.get('notes')
    if (appends.length > 0 && notesIndex) {
      const rows = appends.map((item) => recordToRow(item.record, notesIndex.header))
      const { first } = await this.api.appendRows(spreadsheetId, 'notes', rows)
      appends.forEach((item, offset) => notesIndex.rows.set(item.key, first + offset))
      notesIndex.lastRow = Math.max(notesIndex.lastRow, first + appends.length - 1)
    }
  }

  /** Row numbers of a sheet; re-reads the header and key column when they are too old. */
  private async index(spreadsheetId: string, sheet: SheetName, maxAgeMs: number) {
    const cacheKey = `${spreadsheetId}|${sheet}`
    const cached = this.indexes.get(cacheKey)
    if (cached && this.now() - cached.readAt <= maxAgeMs) return cached

    const [headerRows = []] = await this.api.getValues(spreadsheetId, [`${sheet}!1:1`])
    const header = readHeader(headerRows[0])
    const keyColumn = header.get(KEY_COLUMN[sheet])
    if (keyColumn === undefined) {
      throw new Error(`Sheet "${sheet}" has no "${KEY_COLUMN[sheet]}" column`)
    }
    const versionColumn = sheet === 'notes' ? header.get('updated_at') : undefined
    const ranges = [columnRange(sheet, keyColumn)]
    if (versionColumn !== undefined) ranges.push(columnRange(sheet, versionColumn))
    const [keys = [], versions = []] = await this.api.getValues(spreadsheetId, ranges)

    const rows = keys.map((row, i) => {
      const full: Cell[] = []
      full[keyColumn] = row[0] ?? ''
      if (versionColumn !== undefined) full[versionColumn] = versions[i]?.[0] ?? ''
      return full
    })
    return this.storeIndex(spreadsheetId, sheet, [headerRows[0] ?? [], ...rows.slice(1)])
  }

  /** Builds the index of a sheet from its rows (the first one is the header). */
  private storeIndex(spreadsheetId: string, sheet: SheetName, rows: readonly Cell[][]) {
    const header = readHeader(rows[0])
    const keyColumn = header.get(KEY_COLUMN[sheet])
    const versionColumn = header.get('updated_at')
    const index: SheetIndex = {
      header,
      rows: new Map(),
      versions: new Map(),
      lastRow: 1,
      readAt: this.now(),
    }
    rows.forEach((row, i) => {
      if (i === 0 || keyColumn === undefined) return
      const key = normalizeKey(sheet, row[keyColumn])
      if (key === '') return
      const rowNumber = i + 1
      index.rows.set(key, rowNumber)
      index.lastRow = rowNumber
      if (sheet === 'notes' && versionColumn !== undefined) {
        const version = row[versionColumn]
        if (version !== undefined) index.versions.set(key, String(version))
      }
    })
    this.indexes.set(`${spreadsheetId}|${sheet}`, index)
    return index
  }

  private async readAll(onlyProjectId?: string): Promise<void> {
    const full = onlyProjectId === undefined
    const read: SpreadsheetData[] = []
    let projects: Project[]

    if (full) {
      const [, notesRows = [], labelRows = [], projectRows = []] = await this.api.getValues(
        this.home,
        ['meta', 'notes', 'labels', 'projects'],
      )
      this.storeIndex(this.home, 'notes', notesRows)
      this.storeIndex(this.home, 'labels', labelRows)
      this.storeIndex(this.home, 'projects', projectRows)
      const projectHeader = readHeader(projectRows[0])
      projects = projectRows
        .slice(1)
        .map((row) => rowToProject(row, projectHeader))
        .filter((project): project is Project => project !== null)
      read.push({ spreadsheetId: this.home, projectId: null, notesRows, labelRows })
    } else {
      projects = await this.db.projects.toArray()
    }

    const sharedFiles = full ? await this.sharedFiles() : null
    const targets = projects.filter(
      (project) => !project.removed && (full || project.id === onlyProjectId),
    )
    const unavailable = new Set<string>()
    for (const project of targets) {
      try {
        const [notes = [], labels = []] = await this.api.getValues(project.spreadsheetId, [
          'notes',
          'labels',
        ])
        this.storeIndex(project.spreadsheetId, 'notes', notes)
        this.storeIndex(project.spreadsheetId, 'labels', labels)
        read.push({
          spreadsheetId: project.spreadsheetId,
          projectId: project.id,
          notesRows: notes,
          labelRows: labels,
        })
      } catch (error) {
        if (error instanceof AuthError || error instanceof TransientError) throw error
        // Deleted, or access was closed: the project is marked, its cache is kept.
        console.error(`DevNotes: cannot read project "${project.name}"`, error)
        unavailable.add(project.id)
      }
    }

    const flagged = projects.map((project): Project => {
      const next: Project = { ...project }
      const shared = sharedFiles?.get(project.spreadsheetId)?.shared
      if (sharedFiles) next.shared = shared ?? false
      if (targets.includes(project)) next.unavailable = unavailable.has(project.id)
      return next
    })

    await this.merge(flagged, read, full)
    for (const listener of this.changeListeners) listener()
  }

  /** Drive's `shared` flag of project spreadsheets; null when it cannot be read now. */
  private async sharedFiles(): Promise<Map<string, { shared: boolean }> | null> {
    try {
      return await this.api.listProjectFiles()
    } catch (error) {
      if (error instanceof AuthError || error instanceof TransientError) throw error
      console.error('DevNotes: cannot list project spreadsheets', error)
      return null
    }
  }

  /**
   * Puts what was read into the cache. Anything with unsent local edits keeps the
   * local version; everything else takes the version from the spreadsheet.
   */
  private async merge(
    projects: Project[],
    read: SpreadsheetData[],
    /** The whole `projects` sheet was read: projects missing from it are gone. */
    replaceProjects: boolean,
  ): Promise<void> {
    const { db } = this
    await db.transaction('rw', [db.notes, db.labels, db.projects, db.queue], async () => {
      const pending = await db.queue.toArray()
      const pendingNotes = new Set(pending.filter((op) => op.sheet === 'notes').map((op) => op.key))
      const pendingProjects = new Set(
        pending.filter((op) => op.sheet === 'projects').map((op) => op.key),
      )
      const pendingLabelSheets = new Set(
        pending.filter((op) => op.sheet === 'labels').map((op) => op.spreadsheetId),
      )

      // Projects
      const remoteProjectIds = new Set(projects.map((project) => project.id))
      const localProjects = await db.projects.toArray()
      await db.projects.bulkPut(projects.filter((project) => !pendingProjects.has(project.id)))
      if (replaceProjects) {
        await db.projects.bulkDelete(
          localProjects
            .filter((p) => !remoteProjectIds.has(p.id) && !pendingProjects.has(p.id))
            .map((p) => p.id),
        )
      }

      // Notes
      const remote = new Map<string, Note>()
      for (const sheet of read) {
        const header = readHeader(sheet.notesRows[0])
        for (const row of sheet.notesRows.slice(1)) {
          const note = rowToNote(row, header, sheet.projectId)
          if (note && preferNote(remote.get(note.id), note)) remote.set(note.id, note)
        }
      }
      const readProjects = new Set(read.map((sheet) => sheet.projectId))
      const local = await db.notes.toArray()
      await db.notes.bulkPut([...remote.values()].filter((note) => !pendingNotes.has(note.id)))
      await db.notes.bulkDelete(
        local
          .filter(
            (note) =>
              !remote.has(note.id) &&
              !pendingNotes.has(note.id) &&
              readProjects.has(note.projectId),
          )
          .map((note) => note.id),
      )

      // Labels: each spreadsheet's own list, unless it has unsent label edits.
      for (const sheet of read) {
        if (pendingLabelSheets.has(sheet.spreadsheetId)) continue
        const header = readHeader(sheet.labelRows[0])
        const labels = sheet.labelRows
          .slice(1)
          .map((row) => rowToLabel(row, header))
          .filter((label): label is CustomLabel => label !== null)
        await db.labels.where('spreadsheetId').equals(sheet.spreadsheetId).delete()
        await db.labels.bulkPut(
          labels.map((label) => ({
            ...label,
            spreadsheetId: sheet.spreadsheetId,
            key: `${sheet.spreadsheetId}|${labelKey(label.name)}`,
          })),
        )
      }
    })
  }
}

interface SpreadsheetData {
  spreadsheetId: string
  projectId: string | null
  notesRows: Cell[][]
  labelRows: Cell[][]
}
