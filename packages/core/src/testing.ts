import { createNote, type Note, type NotePatch } from './note'

let counter = 0

/** Test helper: a valid note with only the interesting fields spelled out. */
export function makeNote(overrides: NotePatch & { id?: string; updatedAt?: string } = {}): Note {
  counter += 1
  const base = createNote({
    id: `note-${String(counter)}`,
    now: '2026-11-10T10:00:00.000Z',
    title: `Note ${String(counter)}`,
    projectId: null,
  })
  return { ...base, ...overrides }
}
