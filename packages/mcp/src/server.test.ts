import {
  BUG_TEMPLATE,
  createNote,
  noteToRecord,
  projectToRecord,
  readHeader,
  recordToRow,
  type Note,
} from '@devnotes/core'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, describe, expect, it } from 'vitest'
import { FakeSheets } from './fakeSheets'
import { LoginRequiredError } from './oauth'
import { createDevNotesServer } from './server'
import { DevNotesStore } from './store'

const T0 = '2026-11-19T09:00:00.000Z'
const NOW = '2026-11-20T10:00:00.000Z'

interface Setup {
  sheets: FakeSheets
  home: string
  game: string
  call: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: Record<string, unknown>; isError: boolean }>
}

const clients: Client[] = []

afterEach(async () => {
  for (const client of clients.splice(0)) await client.close()
})

function addNote(
  sheets: FakeSheets,
  spreadsheetId: string,
  note: Partial<Note> & { id: string; title: string },
) {
  const rows = sheets.sheet(spreadsheetId, 'notes')
  const full = {
    ...createNote({ id: note.id, now: T0, title: note.title, projectId: null }),
    ...note,
  }
  rows.push(recordToRow(noteToRecord(full), readHeader(rows[0])))
}

async function connect(store: () => Promise<DevNotesStore>) {
  const server = createDevNotesServer(store)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1.0.0' })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  clients.push(client)
  return async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args })
    const content = result.content as { type: string; text: string }[]
    const text = content[0]?.text ?? '{}'
    let data: Record<string, unknown>
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      // Input validation errors of the SDK come as plain text.
      data = { error: text }
    }
    return { data, isError: result.isError === true }
  }
}

async function setup(): Promise<Setup> {
  const sheets = new FakeSheets()
  const home = sheets.create('home', 'DevNotes')
  const game = sheets.create('project', 'Платформер')
  sheets.sheet(home, 'projects').push(
    recordToRow(
      projectToRecord({
        id: 'p-game',
        name: 'Платформер',
        spreadsheetId: game,
        role: 'owner',
        order: 0,
        addedAt: T0,
        removed: false,
      }),
      readHeader(sheets.sheet(home, 'projects')[0]),
    ),
  )
  let ids = 0
  const store = new DevNotesStore(sheets, {
    now: () => NOW,
    newId: () => `new-${String((ids += 1))}`,
  })
  const call = await connect(() => Promise.resolve(store))
  return { sheets, home, game, call }
}

describe('MCP tools', () => {
  it('lists the five tools with descriptions', async () => {
    const sheets = new FakeSheets()
    const server = createDevNotesServer(() => Promise.resolve(new DevNotesStore(sheets)))
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'test', version: '1.0.0' })
    await Promise.all([server.connect(serverSide), client.connect(clientSide)])
    clients.push(client)

    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).toSorted()).toEqual([
      'create_notes',
      'get_note',
      'list_notes',
      'list_projects',
      'update_note',
    ])
    expect(tools.find((tool) => tool.name === 'create_notes')?.description).toMatch(/review/)
  })

  it('list_projects returns the projects and "none"', async () => {
    const { call } = await setup()
    const { data } = await call('list_projects')
    expect(data.projects).toEqual([
      { id: 'none', name: 'Без проекта', role: null },
      { id: 'p-game', name: 'Платформер', role: 'owner' },
    ])
  })

  it('list_notes filters and leaves out archived and deleted notes', async () => {
    const { sheets, game, call } = await setup()
    addNote(sheets, game, { id: 'a', title: 'Падает при старте', labels: ['Баг'], status: 'wip' })
    addNote(sheets, game, { id: 'b', title: 'Крюк-кошка', labels: ['Идея'] })
    addNote(sheets, game, { id: 'c', title: 'В архиве', archived: true })
    addNote(sheets, game, { id: 'd', title: 'Удалена', deleted: true })
    addNote(sheets, game, {
      id: 'e',
      title: 'Утечка',
      labels: ['Баг'],
      solution: 'Отписка от событий',
    })

    const all = await call('list_notes', { projectId: 'p-game' })
    expect(all.data.count).toBe(3)

    const bugs = await call('list_notes', { projectId: 'p-game', label: 'баг' })
    expect((bugs.data.notes as { id: string }[]).map((n) => n.id).toSorted()).toEqual(['a', 'e'])

    const wip = await call('list_notes', { projectId: 'p-game', status: 'wip' })
    expect((wip.data.notes as { id: string }[]).map((n) => n.id)).toEqual(['a'])

    const found = await call('list_notes', { projectId: 'p-game', query: 'ОТПИСКА' })
    expect(found.data.notes).toEqual([expect.objectContaining({ id: 'e', hasSolution: true })])

    const limited = await call('list_notes', { projectId: 'p-game', limit: 1 })
    expect(limited.data.count).toBe(1)
  })

  it('get_note returns a note in full, from any project', async () => {
    const { sheets, game, call } = await setup()
    addNote(sheets, game, { id: 'e', title: 'Утечка', body: 'Текст', solution: 'Отписка' })

    const { data } = await call('get_note', { noteId: 'e' })
    expect(data.note).toMatchObject({
      id: 'e',
      title: 'Утечка',
      body: 'Текст',
      solution: 'Отписка',
    })
  })

  it('create_notes always puts cards on review and creates missing labels', async () => {
    const { sheets, home, game, call } = await setup()
    const { data, isError } = await call('create_notes', {
      projectId: 'p-game',
      notes: [
        { title: 'Монеты не сохраняются', labels: ['bug'] },
        { title: 'Звук шагов', body: 'Трава, камень', labels: ['Звук'], status: 'wip' },
      ],
    })

    expect(isError).toBe(false)
    expect(data.created).toEqual([
      { id: 'new-1', title: 'Монеты не сохраняются' },
      { id: 'new-2', title: 'Звук шагов' },
    ])
    expect(data.newLabels).toEqual(['Звук'])
    expect(sheets.records(game, 'notes')).toEqual([
      expect.objectContaining({
        id: 'new-1',
        labels: '["Баг"]',
        body: BUG_TEMPLATE,
        source: 'ai_mcp',
        review: 'pending',
        created_at: NOW,
      }),
      expect.objectContaining({ id: 'new-2', status: 'wip', source: 'ai_mcp', review: 'pending' }),
    ])
    expect(sheets.records(home, 'labels')).toEqual([
      expect.objectContaining({ name: 'Звук', created_at: NOW }),
    ])
  })

  it('create_notes puts cards outside projects into the home spreadsheet', async () => {
    const { sheets, home, call } = await setup()
    await call('create_notes', { projectId: 'none', notes: [{ title: 'Спросить про спрайты' }] })
    expect(sheets.records(home, 'notes')).toEqual([
      expect.objectContaining({ title: 'Спросить про спрайты', review: 'pending' }),
    ])
  })

  it('create_notes refuses more than 50 cards', async () => {
    const { call } = await setup()
    const notes = Array.from({ length: 51 }, (_, i) => ({ title: `Карточка ${String(i)}` }))
    const { isError } = await call('create_notes', { projectId: 'p-game', notes })
    expect(isError).toBe(true)
  })

  it('update_note changes status, labels and solution only, found by id after re-sorting', async () => {
    const { sheets, game, call } = await setup()
    addNote(sheets, game, { id: 'a', title: 'Первая', labels: ['Баг'] })
    addNote(sheets, game, { id: 'b', title: 'Утечка', body: 'Текст', labels: ['Баг'] })
    // The user sorted the sheet by hand, and changed the title on the website meanwhile.
    const rows = sheets.sheet(game, 'notes')
    ;[rows[1], rows[2]] = [rows[2] ?? [], rows[1] ?? []]
    const title = readHeader(rows[0]).get('title') ?? 0
    const row = rows[1]
    row[title] = 'Утечка памяти'

    const { data } = await call('update_note', {
      noteId: 'b',
      status: 'done',
      solution: 'Отписка от событий',
    })

    expect(data.note).toMatchObject({ status: 'done', labels: ['Баг', 'Фикс'] })
    // Only status, labels, solution and updated_at are written (columns D–E, I, M of row 2).
    expect(sheets.written).toEqual(['notes!D2:E2', 'notes!I2:I2', 'notes!M2:M2'])
    expect(sheets.records(game, 'notes')).toEqual([
      expect.objectContaining({
        id: 'b',
        title: 'Утечка памяти',
        body: 'Текст',
        status: 'done',
        labels: '["Баг","Фикс"]',
        solution: 'Отписка от событий',
        updated_at: NOW,
      }),
      expect.objectContaining({ id: 'a', status: 'new', solution: '' }),
    ])
  })

  it('explains an unknown project or note', async () => {
    const { call } = await setup()
    const project = await call('list_notes', { projectId: 'nope' })
    expect(project).toMatchObject({ isError: true })
    expect(String(project.data.error)).toMatch(/list_projects/)

    const note = await call('get_note', { noteId: 'nope' })
    expect(String(note.data.error)).toMatch(/list_notes/)
  })

  it('asks to sign in when there is no saved login', async () => {
    const call = await connect(() => Promise.reject(new LoginRequiredError('Not signed in')))
    const { data, isError } = await call('list_projects')
    expect(isError).toBe(true)
    expect(String(data.error)).toMatch(/devnotes-mcp login/)
  })
})
