import type { CustomLabel, Note, Project } from '@devnotes/core'

export interface DataSnapshot {
  notes: Note[]
  labels: CustomLabel[]
  projects: Project[]
}

/**
 * Everything the app needs from a storage backend. All work with Google hides behind
 * this interface; the in-memory implementation powers the demo mode (`?demo=1`).
 *
 * Notes are always written whole: the last write of a note wins.
 */
export interface DataStore {
  load(): Promise<DataSnapshot>

  createNote(note: Note): Promise<void>
  updateNote(note: Note): Promise<void>
  /** The note already carries the new `projectId`; `fromProjectId` is where it was. */
  moveNote(note: Note, fromProjectId: string | null): Promise<void>

  createLabel(label: CustomLabel): Promise<void>
  /** `currentName` identifies the label, since a rename changes its name. */
  updateLabel(currentName: string, label: CustomLabel): Promise<void>
  deleteLabel(name: string): Promise<void>

  /** Creates the project's own storage (a spreadsheet, for Google) and returns the project. */
  createProject(name: string): Promise<Project>
  updateProject(project: Project): Promise<void>

  /**
   * Stores that sync in the background (Google) call the listener with fresh data
   * after reading the spreadsheets. Returns the unsubscribe function.
   */
  subscribe?(listener: (snapshot: DataSnapshot) => void): () => void
}
