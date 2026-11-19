import { describe, expect, it } from 'vitest'
import type { Project } from './project'
import {
  NO_FILTERS,
  countInScope,
  countLabel,
  countStatuses,
  listedNotes,
  noteMatchesQuery,
  selectNotes,
} from './selectors'
import { makeNote } from './testing'

const project = (id: string, removed = false): Project => ({
  id,
  name: id,
  spreadsheetId: '',
  role: 'owner',
  order: 0,
  addedAt: '2026-11-01T00:00:00.000Z',
  removed,
})

describe('listedNotes', () => {
  it('hides deleted notes, cards on review and notes of removed projects', () => {
    const notes = [
      makeNote({ id: 'ok' }),
      makeNote({ id: 'deleted', deleted: true }),
      makeNote({ id: 'pending', review: 'pending' }),
      makeNote({ id: 'in-project', projectId: 'game' }),
      makeNote({ id: 'in-removed', projectId: 'old' }),
    ]
    const listed = listedNotes(notes, [project('game'), project('old', true)])
    expect(listed.map((note) => note.id)).toEqual(['ok', 'in-project'])
  })
})

describe('selectNotes', () => {
  const notes = [
    // `updatedAt` runs against `createdAt` here to show that it does not affect the order.
    makeNote({
      id: 'plain',
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    }),
    makeNote({
      id: 'bug',
      labels: ['Баг'],
      status: 'wip',
      projectId: 'game',
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    }),
    makeNote({
      id: 'pinned',
      labels: ['Идея'],
      pinned: true,
      projectId: 'game',
      createdAt: '2026-11-01T00:00:00.000Z',
    }),
    makeNote({
      id: 'archived',
      labels: ['Баг'],
      archived: true,
      createdAt: '2026-11-15T00:00:00.000Z',
    }),
  ]

  it('shows pinned notes first, the rest by creation time, newest first, without archived ones', () => {
    expect(selectNotes(notes, { kind: 'all' }, NO_FILTERS).map((n) => n.id)).toEqual([
      'pinned',
      'bug',
      'plain',
    ])
  })

  it('limits notes to the scope', () => {
    const ids = (scope: Parameters<typeof selectNotes>[1]) =>
      selectNotes(notes, scope, NO_FILTERS).map((n) => n.id)

    expect(ids({ kind: 'inbox' })).toEqual(['plain'])
    expect(ids({ kind: 'archive' })).toEqual(['archived'])
    expect(ids({ kind: 'project', projectId: 'game' })).toEqual(['pinned', 'bug'])
  })

  it('applies status, label and search filters together', () => {
    const scope = { kind: 'all' } as const
    expect(selectNotes(notes, scope, { ...NO_FILTERS, status: 'wip' }).map((n) => n.id)).toEqual([
      'bug',
    ])
    expect(selectNotes(notes, scope, { ...NO_FILTERS, label: 'идея' }).map((n) => n.id)).toEqual([
      'pinned',
    ])
    expect(selectNotes(notes, scope, { status: 'new', label: 'Баг', query: '' })).toEqual([])
  })

  it('counts notes, statuses and labels inside the scope', () => {
    expect(countInScope(notes, { kind: 'all' })).toBe(3)
    expect(countInScope(notes, { kind: 'inbox' })).toBe(1)
    expect(countStatuses(notes, { kind: 'all' })).toEqual({ new: 2, wip: 1, done: 0 })
    expect(countStatuses(notes, { kind: 'project', projectId: 'game' })).toEqual({
      new: 1,
      wip: 1,
      done: 0,
    })
    expect(countLabel(notes, { kind: 'all' }, 'баг')).toBe(1)
    expect(countLabel(notes, { kind: 'archive' }, 'Баг')).toBe(1)
  })
})

describe('noteMatchesQuery', () => {
  const note = makeNote({
    title: 'Утечка памяти',
    body: 'При смене сцены',
    solution: 'Отписка от событий',
  })

  it('searches the title, the body and the solution without regard to case', () => {
    expect(noteMatchesQuery(note, 'УТЕЧКА')).toBe(true)
    expect(noteMatchesQuery(note, 'сцены')).toBe(true)
    expect(noteMatchesQuery(note, 'отписка')).toBe(true)
    expect(noteMatchesQuery(note, 'геймпад')).toBe(false)
  })

  it('matches everything for an empty query', () => {
    expect(noteMatchesQuery(note, '   ')).toBe(true)
  })
})
