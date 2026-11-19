import { isSameLabel, type CustomLabel, type Note, type Project } from '@devnotes/core'
import type { DataSnapshot, DataStore } from './DataStore'

export interface MemoryStoreOptions {
  initial?: DataSnapshot
  newId?: () => string
  now?: () => string
}

/** Keeps everything in memory. Used by the demo mode and by tests. */
export function createMemoryStore(options: MemoryStoreOptions = {}): DataStore {
  const newId = options.newId ?? (() => crypto.randomUUID())
  const now = options.now ?? (() => new Date().toISOString())
  const data: DataSnapshot = structuredClone(
    options.initial ?? { notes: [], labels: [], projects: [] },
  )

  const putNote = (note: Note) => {
    const index = data.notes.findIndex((existing) => existing.id === note.id)
    if (index === -1) data.notes.push(structuredClone(note))
    else data.notes[index] = structuredClone(note)
  }

  return {
    load: () => Promise.resolve(structuredClone(data)),

    createNote: (note) => {
      putNote(note)
      return Promise.resolve()
    },
    updateNote: (note) => {
      putNote(note)
      return Promise.resolve()
    },
    // With one in-memory list a move is just an update; with spreadsheets it is
    // "add to the new one, soft-delete in the old one".
    moveNote: (note) => {
      putNote(note)
      return Promise.resolve()
    },

    createLabel: (label: CustomLabel) => {
      data.labels.push({ ...label })
      return Promise.resolve()
    },
    updateLabel: (currentName, label) => {
      const index = data.labels.findIndex((existing) => isSameLabel(existing.name, currentName))
      if (index === -1) data.labels.push({ ...label })
      else data.labels[index] = { ...label }
      return Promise.resolve()
    },
    deleteLabel: (name) => {
      data.labels = data.labels.filter((existing) => !isSameLabel(existing.name, name))
      return Promise.resolve()
    },

    createProject: (name) => {
      const project: Project = {
        id: newId(),
        name,
        spreadsheetId: '',
        role: 'owner',
        order: data.projects.reduce((max, existing) => Math.max(max, existing.order), -1) + 1,
        addedAt: now(),
        removed: false,
      }
      data.projects.push(project)
      return Promise.resolve({ ...project })
    },
    updateProject: (project) => {
      const index = data.projects.findIndex((existing) => existing.id === project.id)
      if (index !== -1) data.projects[index] = { ...project }
      return Promise.resolve()
    },
  }
}
