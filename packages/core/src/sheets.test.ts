import { describe, expect, it } from 'vitest'
import {
  NOTE_COLUMNS,
  columnLetter,
  labelToRecord,
  metaRows,
  noteToRecord,
  projectToRecord,
  rangeRows,
  readHeader,
  readMeta,
  recordToRow,
  recordToSegments,
  rowToLabel,
  rowToNote,
  rowToProject,
  sheetsOf,
} from './sheets'
import { makeNote } from './testing'

const noteHeader = readHeader([...NOTE_COLUMNS])

describe('notes ↔ rows', () => {
  it('writes and reads back the same note', () => {
    const note = makeNote({
      id: 'a1',
      title: 'Персонаж проваливается',
      body: 'Что случилось: ...',
      status: 'wip',
      labels: ['Баг', 'Фикс'],
      color: 'red',
      pinned: true,
      solution: 'Поднял коллайдер',
      projectId: 'game',
    })

    const row = recordToRow(noteToRecord(note), noteHeader)

    expect(rowToNote(row, noteHeader, 'game')).toEqual(note)
  })

  it('stores flags as booleans and labels as a JSON array', () => {
    const record = noteToRecord(makeNote({ labels: ['Баг'], pinned: true }))
    expect(record.pinned).toBe(true)
    expect(record.archived).toBe(false)
    expect(record.labels).toBe('["Баг"]')
    expect(record.review).toBe('')
  })

  it('keeps text that looks like a formula as plain text', () => {
    const note = makeNote({ title: '=SUM(A1:A3)', body: '=1+1' })
    const row = recordToRow(noteToRecord(note), noteHeader)
    expect(rowToNote(row, noteHeader, null)?.title).toBe('=SUM(A1:A3)')
  })

  it('finds columns by name, whatever their order', () => {
    const header = readHeader(['title', 'extra', 'id', 'updated_at', 'status'])
    const note = rowToNote(['Заметка', 'x', 'n1', '2026-11-19T09:00:00.000Z', 'done'], header, null)
    expect(note).toMatchObject({ id: 'n1', title: 'Заметка', status: 'done', labels: [] })
  })

  it('keeps the AI source as it is and reads the old "ai" value', () => {
    expect(noteToRecord({ ...makeNote(), source: 'ai_mcp' }).source).toBe('ai_mcp')
    const row = (source: string) => recordToRow({ ...noteToRecord(makeNote()), source }, noteHeader)
    expect(rowToNote(row('ai_paste'), noteHeader, null)?.source).toBe('ai_paste')
    expect(rowToNote(row('ai_mcp'), noteHeader, null)?.source).toBe('ai_mcp')
    expect(rowToNote(row('ai'), noteHeader, null)?.source).toBe('ai_paste')
    expect(rowToNote(row('robot'), noteHeader, null)?.source).toBe('user')
  })

  it('accepts hand-edited values', () => {
    const header = readHeader(['id', 'title', 'pinned', 'labels', 'status', 'color', 'updated_at'])
    const note = rowToNote(['n2', 42, 'true', 'not json', 'later', 'pink', ''], header, null)
    expect(note).toMatchObject({
      title: '42',
      pinned: true,
      labels: [],
      status: 'new',
      color: 'default',
      updatedAt: '1970-01-01T00:00:00.000Z',
    })
  })

  it('skips rows without an id', () => {
    expect(rowToNote(['', 'Пусто'], readHeader(['id', 'title']), null)).toBeNull()
    expect(rowToNote([], noteHeader, null)).toBeNull()
  })
})

describe('labels and projects ↔ rows', () => {
  it('round-trips a custom label', () => {
    const header = readHeader(['name', 'color', 'created_at'])
    const label = { name: 'Звук', color: 'teal', createdAt: '2026-11-19T09:00:00.000Z' } as const
    expect(rowToLabel(recordToRow(labelToRecord(label), header), header)).toEqual(label)
  })

  it('skips an empty (cleared) label row', () => {
    expect(rowToLabel(['', '', ''], readHeader(['name', 'color', 'created_at']))).toBeNull()
  })

  it('round-trips a project', () => {
    const header = readHeader([
      'id',
      'name',
      'spreadsheet_id',
      'role',
      'order',
      'added_at',
      'removed',
    ])
    const project = {
      id: 'p1',
      name: 'Платформер',
      spreadsheetId: 'sheet-1',
      role: 'owner',
      order: 2,
      addedAt: '2026-11-19T09:00:00.000Z',
      removed: false,
    } as const
    expect(rowToProject(recordToRow(projectToRecord(project), header), header)).toEqual(project)
  })
})

describe('layout', () => {
  it('lists the sheets of each spreadsheet kind', () => {
    expect(sheetsOf('home')).toEqual(['meta', 'notes', 'labels', 'projects'])
    expect(sheetsOf('project')).toEqual(['meta', 'notes', 'labels'])
  })

  it('reads the meta sheet', () => {
    const meta = readMeta([['key', 'value'], ...metaRows('home', 'DevNotes')])
    expect(meta.get('schema_version')).toBe('1')
    expect(meta.get('kind')).toBe('home')
  })
})

describe('writing rows', () => {
  it('writes only known columns, grouped into adjacent runs', () => {
    const header = readHeader(['id', 'title', 'mine', 'status'])
    expect(recordToSegments({ id: 'n1', title: 'T', status: 'new' }, header)).toEqual([
      { startColumn: 0, values: ['n1', 'T'] },
      { startColumn: 3, values: ['new'] },
    ])
    expect(recordToRow({ id: 'n1', status: 'new' }, header)).toEqual(['n1', '', '', 'new'])
  })
})

describe('A1 helpers', () => {
  it('turns column indexes into letters', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(13)).toBe('N')
    expect(columnLetter(25)).toBe('Z')
    expect(columnLetter(26)).toBe('AA')
  })

  it('reads row numbers from updatedRange', () => {
    expect(rangeRows('notes!A5:N5')).toEqual({ first: 5, last: 5 })
    expect(rangeRows("'notes'!A12:N14")).toEqual({ first: 12, last: 14 })
    expect(rangeRows('notes!A7')).toEqual({ first: 7, last: 7 })
    expect(rangeRows('notes')).toBeNull()
  })
})
