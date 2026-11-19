import { createNote, type Note } from '@devnotes/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeGoogle } from '../../test/fakeGoogle'
import type { DataStore } from '../DataStore'
import { AuthError, TransientError } from './api'
import { CacheDb } from './cache'
import { createGoogleStore } from './googleStore'
import { SyncEngine } from './sync'

const T0 = '2026-11-19T09:00:00.000Z'
const T1 = '2026-11-19T09:05:00.000Z'
const T2 = '2026-11-19T09:10:00.000Z'

let dbCounter = 0

interface Setup {
  google: FakeGoogle
  db: CacheDb
  engine: SyncEngine
  store: DataStore
  home: string
}

let current: Setup | null = null

async function setup(options: { indexMaxAgeMs?: number } = {}): Promise<Setup> {
  const google = new FakeGoogle()
  const home = await google.createSpreadsheet('home', 'DevNotes', 'DevNotes')
  dbCounter += 1
  const db = new CacheDb(`sync-test-${String(dbCounter)}`)
  const engine = new SyncEngine({
    api: google,
    db,
    homeSpreadsheetId: home,
    debounceMs: 60_000,
    ...options,
  })
  let ids = 0
  const store = createGoogleStore({
    api: google,
    db,
    engine,
    newId: () => `project-${String((ids += 1))}`,
    now: () => T0,
  })
  current = { google, db, engine, store, home }
  return current
}

function note(id: string, title: string, patch: Partial<Note> = {}): Note {
  return { ...createNote({ id, now: T0, title, projectId: null }), ...patch }
}

beforeEach(() => {
  current = null
})

afterEach(async () => {
  current?.engine.stop()
  await current?.db.delete()
})

describe('sending the write queue', () => {
  it('appends a new note and then updates the same row', async () => {
    const { google, engine, store, home } = await setup()

    await store.createNote(note('n1', 'Персонаж проваливается под пол', { labels: ['Баг'] }))
    await engine.flushNow()

    expect(google.records(home, 'notes')).toEqual([
      expect.objectContaining({
        id: 'n1',
        title: 'Персонаж проваливается под пол',
        labels: '["Баг"]',
        pinned: false,
        deleted: false,
      }),
    ])

    await store.updateNote(note('n1', 'Новый заголовок', { updatedAt: T1 }))
    await engine.flushNow()

    expect(google.records(home, 'notes')).toHaveLength(1)
    expect(google.records(home, 'notes')[0]).toMatchObject({ title: 'Новый заголовок' })
    expect(engine.status).toBe('synced')
  })

  it('sends quick successive edits of a note as one write', async () => {
    const { google, engine, store, home } = await setup()
    await store.createNote(note('n1', 'Т'))
    await store.updateNote(note('n1', 'Те', { updatedAt: T1 }))
    await store.updateNote(note('n1', 'Тест', { updatedAt: T2 }))

    await engine.flushNow()

    expect(google.count('appendRows')).toBe(1)
    expect(google.records(home, 'notes')).toEqual([expect.objectContaining({ title: 'Тест' })])
  })

  it('keeps the queue offline and sends it once the network is back', async () => {
    const { google, engine, store, home } = await setup()
    google.fail = () => new TransientError('offline')

    await store.createNote(note('n1', 'Без сети'))
    await engine.flushNow()

    expect(engine.status).toBe('offline')
    expect(await engine.hasPending()).toBe(true)

    google.fail = null
    await engine.flushNow()

    expect(engine.status).toBe('synced')
    expect(await engine.hasPending()).toBe(false)
    expect(google.records(home, 'notes')).toEqual([expect.objectContaining({ title: 'Без сети' })])
  })

  it('keeps the queue when the session expires', async () => {
    const { google, engine, store } = await setup()
    google.fail = () => new AuthError('401')

    await store.createNote(note('n1', 'Правка'))
    await engine.flushNow()

    expect(engine.status).toBe('auth')
    expect(await engine.hasPending()).toBe(true)
  })

  it('finds the row by id again after the sheet was re-sorted by hand', async () => {
    const { google, engine, store, home } = await setup({ indexMaxAgeMs: 0 })
    await store.createNote(note('a', 'Первая'))
    await store.createNote(note('b', 'Вторая'))
    await engine.flushNow()

    const rows = google.sheet(home, 'notes')
    ;[rows[1], rows[2]] = [rows[2] ?? [], rows[1] ?? []]

    await store.updateNote(note('a', 'Первая, исправлено', { updatedAt: T1 }))
    await engine.flushNow()

    expect(google.records(home, 'notes').map((r) => [r.id, r.title])).toEqual([
      ['b', 'Вторая'],
      ['a', 'Первая, исправлено'],
    ])
  })

  it('does not overwrite a newer version of the note in the sheet', async () => {
    const { google, engine, store, home } = await setup({ indexMaxAgeMs: 0 })
    await store.createNote(note('n1', 'Старое'))
    await engine.flushNow()

    // Another device saved the note later than this one edited it.
    const rows = google.sheet(home, 'notes')
    const header = google.sheet(home, 'notes')[0] ?? []
    const row = rows[1] ?? []
    row[header.indexOf('title')] = 'С другого устройства'
    row[header.indexOf('updated_at')] = T2

    await store.updateNote(note('n1', 'Локальная правка', { updatedAt: T1 }))
    await engine.flushNow()

    expect(google.records(home, 'notes')[0]).toMatchObject({ title: 'С другого устройства' })
  })

  it('keeps a formula-looking title as text', async () => {
    const { google, engine, store, home } = await setup()
    await store.createNote(note('n1', '=1+1'))
    await engine.flushNow()
    expect(google.records(home, 'notes')[0]).toMatchObject({ title: '=1+1' })
  })
})

describe('projects and labels', () => {
  it('creates a spreadsheet for a project and moves a note into it', async () => {
    const { google, engine, store, home } = await setup()
    await store.createNote(note('n1', 'Крюк-кошка'))
    const project = await store.createProject('Платформер')
    await engine.flushNow()

    expect(google.spreadsheets.get(project.spreadsheetId)).toMatchObject({
      kind: 'project',
      title: 'DevNotes — Платформер',
    })
    expect(google.records(home, 'projects')).toEqual([
      expect.objectContaining({ id: project.id, spreadsheet_id: project.spreadsheetId }),
    ])

    await store.moveNote(note('n1', 'Крюк-кошка', { projectId: project.id, updatedAt: T1 }), null)
    await engine.flushNow()

    expect(google.records(home, 'notes')).toEqual([
      expect.objectContaining({ id: 'n1', deleted: true }),
    ])
    expect(google.records(project.spreadsheetId, 'notes')).toEqual([
      expect.objectContaining({ id: 'n1', deleted: false }),
    ])

    // After a reload the note is read back into the project, not as deleted.
    await engine.refresh()
    expect((await store.load()).notes).toEqual([
      expect.objectContaining({ id: 'n1', projectId: project.id, deleted: false }),
    ])
  })

  it('renames and deletes a custom label in place', async () => {
    const { google, engine, store, home } = await setup()
    await store.createLabel({ name: 'Звук', color: 'teal', createdAt: T0 })
    await store.createLabel({ name: 'Сеть', color: 'blue', createdAt: T0 })
    await engine.flushNow()

    await store.updateLabel('звук', { name: 'Аудио', color: 'pink', createdAt: T0 })
    await engine.flushNow()
    expect(google.records(home, 'labels').map((r) => [r.name, r.color])).toEqual([
      ['Аудио', 'pink'],
      ['Сеть', 'blue'],
    ])

    await store.deleteLabel('Аудио')
    await engine.flushNow()
    expect(google.records(home, 'labels').map((r) => r.name)).toEqual(['', 'Сеть'])

    await engine.refresh()
    expect((await store.load()).labels.map((label) => label.name)).toEqual(['Сеть'])
  })
})

describe('reading the spreadsheets back', () => {
  it('takes edits made on another device', async () => {
    const { google, engine, store, home } = await setup()
    await store.createNote(note('n1', 'Заметка'))
    await engine.flushNow()

    const header = google.sheet(home, 'notes')[0] ?? []
    const row = google.sheet(home, 'notes')[1] ?? []
    row[header.indexOf('status')] = 'done'
    row[header.indexOf('updated_at')] = T2
    google
      .sheet(home, 'notes')
      .push(
        header.map((column) =>
          column === 'id'
            ? 'n2'
            : column === 'title'
              ? 'С телефона'
              : column === 'updated_at'
                ? T2
                : '',
        ),
      )

    await engine.refresh()

    const notes = (await store.load()).notes
    expect(notes.map((n) => [n.id, n.title, n.status])).toEqual([
      ['n1', 'Заметка', 'done'],
      ['n2', 'С телефона', 'new'],
    ])
  })

  it('keeps unsent local edits over the sheet', async () => {
    const { google, engine, store } = await setup()
    google.fail = (method) => (method === 'appendRows' ? new TransientError('offline') : null)
    await store.createNote(note('n1', 'Ещё не отправлена'))
    await engine.flushNow()

    google.fail = null
    await engine.refresh()

    expect((await store.load()).notes.map((n) => n.title)).toEqual(['Ещё не отправлена'])
  })

  it('tells subscribers about fresh data', async () => {
    const { engine, store } = await setup()
    const snapshots: number[] = []
    const done = new Promise<void>((resolve) => {
      store.subscribe?.((snapshot) => {
        snapshots.push(snapshot.notes.length)
        resolve()
      })
    })
    await store.createNote(note('n1', 'Заметка'))
    await engine.flushNow()
    await engine.refresh()
    await done
    expect(snapshots).toEqual([1])
  })
})
