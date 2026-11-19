import {
  allLabels,
  applyBugRules,
  applyNotePatch,
  createNote,
  isSameLabel,
  nextStatus,
  parseQuickInput,
  removeLabelFromList,
  renameLabelInList,
  toggleChecklistLine,
  toggleLabel,
  validateLabelName,
  validateProjectName,
  type CustomLabel,
  type LabelColor,
  type LabelNameError,
  type Note,
  type NotePatch,
  type NoteStatus,
  type Project,
  type ProjectNameError,
} from '@devnotes/core'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DataSnapshot, DataStore } from '../data/DataStore'

/** How long the "Deleted — Undo" message stays on screen. */
export const UNDO_TIMEOUT_MS = 5000

export interface DeletedToast {
  /** Changes with every deletion so the countdown restarts. */
  id: number
  /** One note, or several deleted together from the selection panel. */
  noteIds: string[]
}

/** How the notes are shown: a grid of cards or a board with a column per status. */
export type NotesView = 'grid' | 'board'

const VIEW_STORAGE_KEY = 'devnotes.view'

function readStoredView(): NotesView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'board' ? 'board' : 'grid'
  } catch {
    return 'grid'
  }
}

function storeView(view: NotesView): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view)
  } catch {
    // Storage may be unavailable (private mode); the view then resets on reload.
  }
}

export interface AppActions {
  load: () => Promise<void>
  /** Takes fresh data from background sync (Google). */
  applySnapshot: (snapshot: DataSnapshot) => void

  /** Creates a note from quick input. Returns false when there is nothing to save. */
  addNote: (text: string, projectId: string | null) => boolean
  patchNote: (id: string, patch: NotePatch) => void
  cycleStatus: (id: string) => void
  toggleNoteLabel: (id: string, label: string) => void
  toggleChecklistItem: (id: string, line: number) => void
  deleteNote: (id: string) => void
  /** Changes the status, as dragging a card to another board column does. */
  setStatus: (id: string, status: NoteStatus) => void
  undoDelete: () => void
  dismissToast: () => void

  openNote: (id: string) => void
  closeNote: () => void

  setQuery: (query: string) => void
  toggleStatusFilter: (status: NoteStatus) => void
  toggleLabelFilter: (label: string) => void

  setView: (view: NotesView) => void
  toggleSelected: (id: string) => void
  clearSelection: () => void
  archiveSelected: () => void
  deleteSelected: () => void

  createLabel: (name: string, color: LabelColor) => LabelNameError | null
  updateLabel: (currentName: string, name: string, color: LabelColor) => LabelNameError | null
  deleteLabel: (name: string) => void

  createProject: (name: string) => Promise<Project | ProjectNameError>
  renameProject: (id: string, name: string) => ProjectNameError | null
  removeProject: (id: string) => void
}

export interface AppState {
  phase: 'loading' | 'ready'
  notes: Note[]
  customLabels: CustomLabel[]
  projects: Project[]
  statusFilter: NoteStatus | null
  labelFilter: string | null
  query: string
  openNoteId: string | null
  toast: DeletedToast | null
  view: NotesView
  /** Notes picked with the card checkboxes; while any is picked, a click selects. */
  selectedIds: string[]
  actions: AppActions
}

export interface AppStoreDeps {
  dataStore: DataStore
  newId?: () => string
  now?: () => string
}

export type AppStore = StoreApi<AppState>

export function createAppStore(deps: AppStoreDeps): AppStore {
  const { dataStore } = deps
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const now = deps.now ?? (() => new Date().toISOString())
  let toastSeq = 0
  let unsubscribe: (() => void) | null = null

  // Saving runs in the background: the interface never waits for storage.
  const persist = (work: Promise<unknown>) => {
    work.catch((error: unknown) => {
      console.error('DevNotes: failed to save changes', error)
    })
  }

  return createStore<AppState>()((set, get) => {
    const replaceNote = (next: Note) => {
      set({ notes: get().notes.map((note) => (note.id === next.id ? next : note)) })
    }

    /** Applies a user edit to a note and saves it. */
    const patchNote = (id: string, patch: NotePatch) => {
      const note = get().notes.find((candidate) => candidate.id === id)
      if (!note) return
      const next = applyBugRules(note, applyNotePatch(note, patch, now()))
      replaceNote(next)
      if (next.projectId !== note.projectId) persist(dataStore.moveNote(next, note.projectId))
      else persist(dataStore.updateNote(next))
    }

    /**
     * Rewrites the label list of every note that carries a label. This is upkeep,
     * not an edit of the note, so `updatedAt` stays as it was.
     */
    const rewriteLabels = (label: string, rewrite: (labels: string[]) => string[]) => {
      const changed: Note[] = []
      const notes = get().notes.map((note) => {
        if (!note.labels.some((name) => isSameLabel(name, label))) return note
        const next = { ...note, labels: rewrite(note.labels) }
        changed.push(next)
        return next
      })
      set({ notes })
      for (const note of changed) persist(dataStore.updateNote(note))
    }

    /** Deletes notes softly and offers "Undo" for five seconds. */
    const deleteNotes = (ids: string[]) => {
      if (ids.length === 0) return
      for (const id of ids) patchNote(id, { deleted: true })
      toastSeq += 1
      const openNoteId = get().openNoteId
      set({
        toast: { id: toastSeq, noteIds: ids },
        openNoteId: openNoteId !== null && ids.includes(openNoteId) ? null : openNoteId,
        selectedIds: get().selectedIds.filter((id) => !ids.includes(id)),
      })
    }

    const actions: AppActions = {
      async load() {
        const snapshot = await dataStore.load()
        actions.applySnapshot(snapshot)
        set({ phase: 'ready' })
        unsubscribe ??= dataStore.subscribe?.(actions.applySnapshot) ?? null
      },

      applySnapshot(snapshot) {
        set({
          notes: snapshot.notes,
          customLabels: snapshot.labels,
          projects: snapshot.projects,
        })
      },

      addNote(text, projectId) {
        const input = parseQuickInput(text, allLabels(get().customLabels))
        if (input.title === '') return false
        const note = applyBugRules(
          null,
          createNote({
            id: newId(),
            now: now(),
            title: input.title,
            projectId,
            labels: input.label === null ? [] : [input.label],
          }),
        )
        set({ notes: [...get().notes, note] })
        persist(dataStore.createNote(note))
        return true
      },

      patchNote,

      cycleStatus(id) {
        const note = get().notes.find((candidate) => candidate.id === id)
        if (note) patchNote(id, { status: nextStatus(note.status) })
      },

      toggleNoteLabel(id, label) {
        const note = get().notes.find((candidate) => candidate.id === id)
        if (note) patchNote(id, { labels: toggleLabel(note.labels, label) })
      },

      toggleChecklistItem(id, line) {
        const note = get().notes.find((candidate) => candidate.id === id)
        if (note) patchNote(id, { body: toggleChecklistLine(note.body, line) })
      },

      deleteNote(id) {
        deleteNotes([id])
      },

      setStatus(id, status) {
        const note = get().notes.find((candidate) => candidate.id === id)
        if (note && note.status !== status) patchNote(id, { status })
      },

      undoDelete() {
        const toast = get().toast
        if (!toast) return
        for (const id of toast.noteIds) patchNote(id, { deleted: false })
        set({ toast: null })
      },

      dismissToast() {
        set({ toast: null })
      },

      openNote(id) {
        set({ openNoteId: id })
      },

      closeNote() {
        set({ openNoteId: null })
      },

      setQuery(query) {
        set({ query })
      },

      toggleStatusFilter(status) {
        set({ statusFilter: get().statusFilter === status ? null : status })
      },

      setView(view) {
        storeView(view)
        set({ view })
      },

      toggleSelected(id) {
        const selected = get().selectedIds
        set({
          selectedIds: selected.includes(id)
            ? selected.filter((candidate) => candidate !== id)
            : [...selected, id],
        })
      },

      clearSelection() {
        set({ selectedIds: [] })
      },

      archiveSelected() {
        for (const id of get().selectedIds) patchNote(id, { archived: true })
        set({ selectedIds: [] })
      },

      deleteSelected() {
        deleteNotes(get().selectedIds)
      },

      toggleLabelFilter(label) {
        const current = get().labelFilter
        set({ labelFilter: current !== null && isSameLabel(current, label) ? null : label })
      },

      createLabel(name, color) {
        const error = validateLabelName(name, allLabels(get().customLabels))
        if (error) return error
        const label: CustomLabel = { name: name.trim(), color, createdAt: now() }
        set({ customLabels: [...get().customLabels, label] })
        persist(dataStore.createLabel(label))
        return null
      },

      updateLabel(currentName, name, color) {
        const existing = get().customLabels.find((label) => isSameLabel(label.name, currentName))
        if (!existing) return null
        const error = validateLabelName(name, allLabels(get().customLabels), currentName)
        if (error) return error

        const label: CustomLabel = { ...existing, name: name.trim(), color }
        set({
          customLabels: get().customLabels.map((candidate) =>
            candidate === existing ? label : candidate,
          ),
        })
        persist(dataStore.updateLabel(currentName, label))

        if (label.name !== existing.name) {
          rewriteLabels(existing.name, (labels) =>
            renameLabelInList(labels, existing.name, label.name),
          )
          const filter = get().labelFilter
          if (filter !== null && isSameLabel(filter, existing.name)) {
            set({ labelFilter: label.name })
          }
        }
        return null
      },

      deleteLabel(name) {
        set({
          customLabels: get().customLabels.filter((label) => !isSameLabel(label.name, name)),
        })
        persist(dataStore.deleteLabel(name))
        rewriteLabels(name, (labels) => removeLabelFromList(labels, name))
        const filter = get().labelFilter
        if (filter !== null && isSameLabel(filter, name)) set({ labelFilter: null })
      },

      async createProject(name) {
        const error = validateProjectName(name)
        if (error) return error
        const project = await dataStore.createProject(name.trim())
        set({ projects: [...get().projects, project] })
        return project
      },

      renameProject(id, name) {
        const error = validateProjectName(name)
        if (error) return error
        const project = get().projects.find((candidate) => candidate.id === id)
        if (!project) return null
        const next = { ...project, name: name.trim() }
        set({ projects: get().projects.map((p) => (p.id === id ? next : p)) })
        persist(dataStore.updateProject(next))
        return null
      },

      removeProject(id) {
        const project = get().projects.find((candidate) => candidate.id === id)
        if (!project) return
        const next = { ...project, removed: true }
        set({ projects: get().projects.map((p) => (p.id === id ? next : p)) })
        persist(dataStore.updateProject(next))
      },
    }

    return {
      phase: 'loading',
      notes: [],
      customLabels: [],
      projects: [],
      statusFilter: null,
      labelFilter: null,
      query: '',
      openNoteId: null,
      toast: null,
      view: readStoredView(),
      selectedIds: [],
      actions,
    }
  })
}
