import { hasLabel } from './labels'
import type { Note, NoteStatus } from './note'
import type { Project } from './project'

/** What part of the notes the user is looking at. */
export type Scope =
  { kind: 'all' } | { kind: 'inbox' } | { kind: 'archive' } | { kind: 'project'; projectId: string }

export interface NoteFilters {
  status: NoteStatus | null
  label: string | null
  query: string
}

export const NO_FILTERS: NoteFilters = { status: null, label: null, query: '' }

/**
 * Notes the app works with at all: not deleted, not waiting for review,
 * and not belonging to a project that was removed from the list.
 */
export function listedNotes(notes: readonly Note[], projects: readonly Project[]): Note[] {
  const active = new Set(projects.filter((project) => !project.removed).map((p) => p.id))
  return notes.filter(
    (note) =>
      !note.deleted &&
      note.review !== 'pending' &&
      (note.projectId === null || active.has(note.projectId)),
  )
}

export function isInScope(note: Note, scope: Scope): boolean {
  switch (scope.kind) {
    case 'archive':
      return note.archived
    case 'all':
      return !note.archived
    case 'inbox':
      return !note.archived && note.labels.length === 0
    case 'project':
      return !note.archived && note.projectId === scope.projectId
  }
}

/** Search in title, body and solution, case-insensitively. An empty query matches all. */
export function noteMatchesQuery(note: Note, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('ru')
  if (needle === '') return true
  return [note.title, note.body, note.solution].some((text) =>
    text.toLocaleLowerCase('ru').includes(needle),
  )
}

/** Pinned notes first, the rest by last change, newest first. */
export function sortNotes(notes: readonly Note[]): Note[] {
  return notes.toSorted(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
  )
}

/** Notes of a scope after filters and search, in display order. Expects listed notes. */
export function selectNotes(notes: readonly Note[], scope: Scope, filters: NoteFilters): Note[] {
  return sortNotes(
    notes.filter(
      (note) =>
        isInScope(note, scope) &&
        (filters.status === null || note.status === filters.status) &&
        (filters.label === null || hasLabel(note.labels, filters.label)) &&
        noteMatchesQuery(note, filters.query),
    ),
  )
}

export function countInScope(notes: readonly Note[], scope: Scope): number {
  return notes.filter((note) => isInScope(note, scope)).length
}

/** Sidebar counters: how many notes of the scope have each status. */
export function countStatuses(notes: readonly Note[], scope: Scope): Record<NoteStatus, number> {
  const counts: Record<NoteStatus, number> = { new: 0, wip: 0, done: 0 }
  for (const note of notes) {
    if (isInScope(note, scope)) counts[note.status] += 1
  }
  return counts
}

/** Sidebar counter: how many notes of the scope carry the label. */
export function countLabel(notes: readonly Note[], scope: Scope, label: string): number {
  return notes.filter((note) => isInScope(note, scope) && hasLabel(note.labels, label)).length
}
