import {
  PROJECT_NAME_MAX_LENGTH,
  labelKey,
  readMeta,
  labelToRecord,
  noteToRecord,
  projectSpreadsheetTitle,
  projectToRecord,
  type CustomLabel,
  type Note,
  type Project,
} from '@devnotes/core'
import type { DataSnapshot, DataStore } from '../DataStore'
import type { GoogleApi } from './api'
import type { CacheDb, QueuedOp } from './cache'
import type { SyncEngine } from './sync'

/** What connecting a shared project ended with. */
export type ConnectResult =
  | { project: Project; alreadyListed: boolean }
  /** The picked spreadsheet is not a DevNotes project. */
  | { error: 'notProject' }

/** DataStore on Google Sheets, plus what only Google can do. */
export interface GoogleDataStore extends DataStore {
  /** Adds a project spreadsheet the user picked in Google Picker to the list. */
  connectProject(spreadsheetId: string): Promise<ConnectResult>
}

/** The project name from its `meta` sheet; "DevNotes" when it is missing. */
function projectName(name: string | undefined): string {
  const trimmed = name?.trim() ?? ''
  return trimmed === '' ? 'DevNotes' : trimmed.slice(0, PROJECT_NAME_MAX_LENGTH)
}

export interface GoogleStoreDeps {
  api: GoogleApi
  db: CacheDb
  engine: SyncEngine
  newId?: () => string
  now?: () => string
}

/**
 * DataStore on Google Sheets. Every change goes to the IndexedDB cache at once and
 * then to the write queue; the SyncEngine sends the queue and reads the sheets back.
 */
export function createGoogleStore(deps: GoogleStoreDeps): GoogleDataStore {
  const { api, db, engine } = deps
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const now = deps.now ?? (() => new Date().toISOString())
  const home = engine.homeSpreadsheetId

  // Local writes run one after another, in the order the app made them.
  let writes: Promise<unknown> = Promise.resolve()
  /** Bumped on every local write, so a snapshot can tell it raced with one. */
  let localVersion = 0

  const write = (work: () => Promise<unknown>): Promise<void> => {
    localVersion += 1
    const next = writes.then(work)
    writes = next.catch(() => undefined)
    return next.then(() => undefined)
  }

  const spreadsheetOf = async (projectId: string | null): Promise<string> => {
    if (projectId === null) return home
    const project = await db.projects.get(projectId)
    if (!project?.spreadsheetId) throw new Error(`Unknown project ${projectId}`)
    return project.spreadsheetId
  }

  const noteOp = (spreadsheetId: string, note: Note): Omit<QueuedOp, 'seq'> => ({
    spreadsheetId,
    sheet: 'notes',
    key: note.id,
    record: noteToRecord(note),
    coalesce: `${spreadsheetId}|notes|${note.id}`,
  })

  const projectOp = (project: Project): Omit<QueuedOp, 'seq'> => ({
    spreadsheetId: home,
    sheet: 'projects',
    key: project.id,
    record: projectToRecord(project),
    coalesce: `${home}|projects|${project.id}`,
  })

  const labelRecordKey = (name: string) => `${home}|${labelKey(name)}`

  const readSnapshot = async (): Promise<DataSnapshot> => {
    const [notes, labels, projects] = await Promise.all([
      db.notes.toArray(),
      db.labels.toArray(),
      db.projects.toArray(),
    ])
    // Labels from all spreadsheets; with different colors the home spreadsheet wins.
    const byName = new Map<string, CustomLabel>()
    for (const label of labels.toSorted(
      (a, b) => Number(b.spreadsheetId === home) - Number(a.spreadsheetId === home),
    )) {
      const key = labelKey(label.name)
      if (!byName.has(key)) {
        byName.set(key, { name: label.name, color: label.color, createdAt: label.createdAt })
      }
    }
    return { notes, labels: [...byName.values()], projects }
  }

  /** A snapshot that includes every local write made so far. */
  const settledSnapshot = async (): Promise<DataSnapshot> => {
    for (;;) {
      const version = localVersion
      await writes
      const snapshot = await readSnapshot()
      if (version === localVersion) return snapshot
    }
  }

  return {
    load: settledSnapshot,

    subscribe(listener) {
      return engine.onChange(() => {
        settledSnapshot().then(listener, (error: unknown) => {
          console.error('DevNotes: cannot read the local cache', error)
        })
      })
    },

    createNote: (note) => write(() => putNote(note)),
    updateNote: (note) => write(() => putNote(note)),

    moveNote: (note, fromProjectId) =>
      write(async () => {
        await db.notes.put(note)
        const [to, from] = await Promise.all([
          spreadsheetOf(note.projectId),
          spreadsheetOf(fromProjectId),
        ])
        // Added to the new spreadsheet with the same id, soft-deleted in the old one.
        await engine.enqueue([
          noteOp(to, note),
          noteOp(from, { ...note, projectId: fromProjectId, deleted: true }),
        ])
      }),

    createLabel: (label) =>
      write(async () => {
        await db.labels.put({ ...label, spreadsheetId: home, key: labelRecordKey(label.name) })
        await engine.enqueue([labelOp(label.name, label)])
      }),

    updateLabel: (currentName, label) =>
      write(async () => {
        await db.labels.delete(labelRecordKey(currentName))
        await db.labels.put({ ...label, spreadsheetId: home, key: labelRecordKey(label.name) })
        await engine.enqueue([labelOp(currentName, label)])
      }),

    deleteLabel: (name) =>
      write(async () => {
        await db.labels.delete(labelRecordKey(name))
        await engine.enqueue([labelOp(name, null)])
      }),

    async createProject(name) {
      // A project is its own spreadsheet, so creating one needs Google right away.
      const spreadsheetId = await api.createSpreadsheet(
        'project',
        projectSpreadsheetTitle(name),
        name,
      )
      const projects = await db.projects.toArray()
      const project: Project = {
        id: newId(),
        name,
        spreadsheetId,
        role: 'owner',
        order: projects.reduce((max, existing) => Math.max(max, existing.order), -1) + 1,
        addedAt: now(),
        removed: false,
      }
      await write(async () => {
        await db.projects.put(project)
        await engine.enqueue([projectOp(project)])
      })
      return project
    },

    updateProject: (project) =>
      write(async () => {
        const before = await db.projects.get(project.id)
        await db.projects.put(project)
        const ops = [projectOp(project)]
        const renamed = before !== undefined && before.name !== project.name
        if (renamed && project.role === 'owner' && !project.unavailable) {
          // The owner's rename also reaches the project spreadsheet: its meta and file name.
          ops.push({
            spreadsheetId: project.spreadsheetId,
            sheet: 'meta',
            key: 'name',
            record: { key: 'name', value: project.name },
            coalesce: `${project.spreadsheetId}|meta|name`,
          })
          api
            .renameSpreadsheet(project.spreadsheetId, projectSpreadsheetTitle(project.name))
            .catch((error: unknown) => {
              console.error('DevNotes: cannot rename the project spreadsheet', error)
            })
        }
        await engine.enqueue(ops)
      }),

    async connectProject(spreadsheetId) {
      const [metaRows = []] = await api.getValues(spreadsheetId, ['meta'])
      const meta = readMeta(metaRows)
      if (meta.get('kind') !== 'project') return { error: 'notProject' }

      const projects = await db.projects.toArray()
      const existing = projects.find((project) => project.spreadsheetId === spreadsheetId)
      if (existing && !existing.removed) return { project: existing, alreadyListed: true }

      const project: Project = existing
        ? { ...existing, removed: false }
        : {
            id: newId(),
            name: projectName(meta.get('name')),
            spreadsheetId,
            role: 'member',
            order: projects.reduce((max, other) => Math.max(max, other.order), -1) + 1,
            addedAt: now(),
            removed: false,
            shared: true,
          }
      await write(async () => {
        await db.projects.put(project)
        await engine.enqueue([projectOp(project)])
      })
      return { project, alreadyListed: false }
    },
  }

  async function putNote(note: Note): Promise<void> {
    await db.notes.put(note)
    await engine.enqueue([noteOp(await spreadsheetOf(note.projectId), note)])
  }

  function labelOp(currentName: string, label: CustomLabel | null): Omit<QueuedOp, 'seq'> {
    return {
      spreadsheetId: home,
      sheet: 'labels',
      key: labelKey(currentName),
      record: label ? labelToRecord(label) : null,
      coalesce: null,
    }
  }
}
