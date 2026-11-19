import { createNote } from '@devnotes/core'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthError } from '../data/google/api'
import { CacheDb, KV } from '../data/google/cache'
import type { TokenSource } from '../data/google/gis'
import { createGoogleSession, type SessionStore } from '../data/google/session'
import { strings } from '../i18n'
import { FakeGoogle } from '../test/fakeGoogle'
import { SessionApp } from './GoogleApp'

let dbCounter = 0
const sessions: SessionStore[] = []
const dbs: CacheDb[] = []

function fakeTokens() {
  const tokens = {
    token: null as string | null,
    ready: () => Promise.resolve(),
    getToken: () => tokens.token,
    request: vi.fn(() => {
      tokens.token = 'token'
      return Promise.resolve()
    }),
    revoke: vi.fn(() => {
      tokens.token = null
      return Promise.resolve()
    }),
  }
  return tokens satisfies TokenSource
}

function newDb(): CacheDb {
  dbCounter += 1
  const db = new CacheDb(`ui-test-${String(dbCounter)}`)
  dbs.push(db)
  return db
}

function startApp(google: FakeGoogle, db: CacheDb, tokens = fakeTokens()) {
  const reload = vi.fn()
  const session = createGoogleSession({
    tokens,
    api: google,
    db,
    reload,
    engineOptions: { debounceMs: 0 },
  })
  sessions.push(session)
  const user = userEvent.setup()
  render(<SessionApp session={session} />)
  return { session, tokens, reload, user }
}

/** A cache as a previous visit left it: account, home spreadsheet and one note. */
async function seedCache(google: FakeGoogle, db: CacheDb) {
  const home = await google.createSpreadsheet('home', 'DevNotes', 'DevNotes')
  await db.setValue(KV.account, google.account)
  await db.setValue(KV.homeSpreadsheetId, home)
  await db.notes.put(
    createNote({
      id: 'cached',
      now: '2026-11-19T09:00:00.000Z',
      title: 'Из кэша',
      projectId: null,
    }),
  )
  return home
}

afterEach(async () => {
  sessions.length = 0
  for (const db of dbs.splice(0)) {
    db.close()
    await db.delete()
  }
})

describe('Google mode', () => {
  it('signs in, creates the home spreadsheet and saves a new note to it', async () => {
    const google = new FakeGoogle()
    const { user, tokens } = startApp(google, newDb())

    const button = await screen.findByRole('button', { name: strings.signIn.button })
    await waitFor(() => {
      expect(button).toBeEnabled()
    })
    await user.click(button)

    await screen.findByRole('navigation', { name: strings.nav.label })
    expect(tokens.request).toHaveBeenCalledWith({ prompt: 'select_account' })
    const [home] = [...google.spreadsheets.keys()]
    expect(google.spreadsheets.get(home ?? '')).toMatchObject({ kind: 'home', title: 'DevNotes' })
    expect(screen.getByText(google.account.name)).toBeVisible()
    expect(screen.getByText(strings.sync.synced)).toBeVisible()

    await user.type(
      screen.getByRole('textbox', { name: strings.quickAdd.label }),
      'баг: Падает{Enter}',
    )

    await waitFor(() => {
      expect(google.records(home ?? '', 'notes')).toEqual([
        expect.objectContaining({ title: 'Падает', labels: '["Баг"]', status: 'new' }),
      ])
    })
    await screen.findByText(strings.sync.synced)
  })

  it('finds the existing home spreadsheet on a new device instead of creating one', async () => {
    const google = new FakeGoogle()
    const home = await google.createSpreadsheet('home', 'DevNotes', 'DevNotes')
    google.sheet(home, 'notes').push(['n1', 'С другого устройства'])
    const { user } = startApp(google, newDb())

    await user.click(await screen.findByRole('button', { name: strings.signIn.button }))

    expect(await screen.findByText('С другого устройства')).toBeVisible()
    expect(google.spreadsheets.size).toBe(1)
  })

  it('shows cached notes at once and syncs after "Continue"', async () => {
    const google = new FakeGoogle()
    const db = newDb()
    const home = await seedCache(google, db)
    google.sheet(home, 'notes').push(['n2', 'Из таблицы'])
    const { user, tokens } = startApp(google, db)

    expect(await screen.findByText('Из кэша')).toBeVisible()
    expect(screen.getByText(strings.sync.auth)).toBeVisible()

    await user.click(screen.getByRole('button', { name: strings.session.continue }))

    expect(await screen.findByText('Из таблицы')).toBeVisible()
    expect(tokens.request).toHaveBeenCalledWith({ prompt: '', loginHint: google.account.email })
    expect(screen.queryByRole('button', { name: strings.session.continue })).toBeNull()
    expect(await screen.findByText(strings.sync.synced)).toBeVisible()
  })

  it('keeps edits when the session expires and sends them after "Renew"', async () => {
    const google = new FakeGoogle()
    const { user } = startApp(google, newDb())
    await user.click(await screen.findByRole('button', { name: strings.signIn.button }))
    await screen.findByRole('navigation', { name: strings.nav.label })
    const [home = ''] = [...google.spreadsheets.keys()]

    google.fail = () => new AuthError('401')
    await user.type(screen.getByRole('textbox', { name: strings.quickAdd.label }), 'Правка{Enter}')

    const banner = await screen.findByRole('region', { name: strings.session.expiredTitle })
    expect(screen.getByText(strings.sync.auth)).toBeVisible()

    google.fail = null
    await user.click(within(banner).getByRole('button', { name: strings.session.renew }))

    await waitFor(() => {
      expect(google.records(home, 'notes')).toEqual([expect.objectContaining({ title: 'Правка' })])
    })
    expect(screen.queryByRole('region', { name: strings.session.expiredTitle })).toBeNull()
  })

  it('warns before signing out with unsent edits, then clears the cache', async () => {
    const google = new FakeGoogle()
    const db = newDb()
    const home = await seedCache(google, db)
    await db.queue.add({
      spreadsheetId: home,
      sheet: 'notes',
      key: 'cached',
      record: { id: 'cached' },
      coalesce: null,
    })
    const { user, tokens, reload } = startApp(google, db)
    await screen.findByText('Из кэша')

    await user.click(screen.getByRole('button', { name: strings.sync.signOut }))
    const dialog = await screen.findByRole('dialog', { name: strings.signOut.title })
    expect(await within(dialog).findByText(strings.signOut.pending)).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: strings.signOut.confirm }))

    await waitFor(() => {
      expect(reload).toHaveBeenCalled()
    })
    expect(tokens.revoke).toHaveBeenCalled()
  })
})
