import { describe, expect, it } from 'vitest'
import {
  BODY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  applyNotePatch,
  createNote,
  nextStatus,
  noteSchema,
} from './note'

const NOW = '2026-11-19T09:00:00.000Z'

describe('createNote', () => {
  it('creates a valid note with the defaults from the spec', () => {
    const note = createNote({ id: 'a', now: NOW, title: 'Title', projectId: null })

    expect(noteSchema.parse(note)).toEqual(note)
    expect(note).toMatchObject({
      status: 'new',
      labels: [],
      color: 'default',
      pinned: false,
      archived: false,
      source: 'user',
      review: null,
      deleted: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
  })

  it('cuts the title to the limit', () => {
    const note = createNote({ id: 'a', now: NOW, title: 'x'.repeat(250), projectId: null })
    expect(note.title).toHaveLength(TITLE_MAX_LENGTH)
  })
})

describe('applyNotePatch', () => {
  it('changes fields, bumps updatedAt and keeps the original untouched', () => {
    const note = createNote({ id: 'a', now: NOW, title: 'Title', projectId: null })
    const later = '2026-11-19T10:00:00.000Z'

    const next = applyNotePatch(note, { status: 'done', pinned: true }, later)

    expect(next).toMatchObject({ status: 'done', pinned: true, updatedAt: later, createdAt: NOW })
    expect(note.status).toBe('new')
  })

  it('enforces text limits', () => {
    const note = createNote({ id: 'a', now: NOW, title: 'Title', projectId: null })
    const next = applyNotePatch(note, { body: 'y'.repeat(BODY_MAX_LENGTH + 5) }, NOW)
    expect(next.body).toHaveLength(BODY_MAX_LENGTH)
  })
})

describe('noteSchema', () => {
  it('accepts the three sources and rejects the old "ai" value', () => {
    const note = createNote({ id: 'a', now: NOW, title: 'Title', projectId: null })
    for (const source of ['user', 'ai_paste', 'ai_mcp']) {
      expect(noteSchema.safeParse({ ...note, source }).success).toBe(true)
    }
    expect(noteSchema.safeParse({ ...note, source: 'ai' }).success).toBe(false)
  })
})

describe('nextStatus', () => {
  it('goes around the circle new → wip → done → new', () => {
    expect(nextStatus('new')).toBe('wip')
    expect(nextStatus('wip')).toBe('done')
    expect(nextStatus('done')).toBe('new')
  })
})
