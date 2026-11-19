import { describe, expect, it } from 'vitest'
import { NOW, sampleData, testNote } from '../test/renderApp'
import { createDemoData } from './demoData'
import { createMemoryStore } from './memoryStore'

describe('memory store', () => {
  it('starts empty and keeps what is written', async () => {
    const store = createMemoryStore({ newId: () => 'p1', now: () => NOW })
    expect(await store.load()).toEqual({ notes: [], labels: [], projects: [] })

    const note = testNote('a', 'First')
    await store.createNote(note)
    await store.updateNote({ ...note, title: 'Changed' })
    await store.createLabel({ name: 'Звук', color: 'teal', createdAt: NOW })
    await store.updateLabel('звук', { name: 'Аудио', color: 'pink', createdAt: NOW })
    const project = await store.createProject('Игра')

    const snapshot = await store.load()
    expect(snapshot.notes).toEqual([{ ...note, title: 'Changed' }])
    expect(snapshot.labels).toEqual([{ name: 'Аудио', color: 'pink', createdAt: NOW }])
    expect(snapshot.projects).toEqual([project])
    expect(project).toMatchObject({ id: 'p1', name: 'Игра', role: 'owner', order: 0 })

    await store.deleteLabel('АУДИО')
    expect((await store.load()).labels).toEqual([])
  })

  it('does not share objects with the caller', async () => {
    const initial = sampleData()
    const store = createMemoryStore({ initial })
    const first = await store.load()
    const firstNote = first.notes[0]
    if (firstNote) firstNote.title = 'mutated outside'

    expect((await store.load()).notes[0]?.title).toBe(initial.notes[0]?.title)
  })

  it('puts a new project after the existing ones', async () => {
    const store = createMemoryStore({ initial: sampleData() })
    expect((await store.createProject('Новый')).order).toBe(2)
  })
})

describe('demo data', () => {
  it('matches the numbers on the design mockup', () => {
    const data = createDemoData(new Date('2026-11-19T09:00:00.000Z'))
    const visible = data.notes.filter((note) => !note.archived)

    expect(visible).toHaveLength(9)
    expect(visible.filter((note) => note.labels.length === 0)).toHaveLength(1)
    expect(visible.filter((note) => note.status === 'new')).toHaveLength(4)
    expect(visible.filter((note) => note.status === 'wip')).toHaveLength(2)
    expect(visible.filter((note) => note.status === 'done')).toHaveLength(3)
    expect(visible.filter((note) => note.projectId === 'platformer')).toHaveLength(5)
  })
})
