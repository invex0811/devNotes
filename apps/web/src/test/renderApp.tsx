import { createNote, type Note, type NotePatch, type Project } from '@devnotes/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoot } from '../app/AppRoot'
import type { DataSnapshot } from '../data/DataStore'
import { createMemoryStore } from '../data/memoryStore'
import { strings } from '../i18n'
import { createAppStore } from '../store/appStore'

export const NOW = '2026-11-19T09:00:00.000Z'

export function testProject(id: string, name: string, order = 0): Project {
  return { id, name, spreadsheetId: '', role: 'owner', order, addedAt: NOW, removed: false }
}

export function testNote(
  id: string,
  title: string,
  patch: NotePatch & { createdAt?: string } = {},
): Note {
  return { ...createNote({ id, now: NOW, title, projectId: null }), ...patch }
}

/** A small data set: two projects and four notes, enough for scopes, filters and search. */
export function sampleData(): DataSnapshot {
  return {
    labels: [],
    projects: [testProject('game', 'Платформер', 0), testProject('site', 'Сайт студии', 1)],
    notes: [
      testNote('floor', 'Персонаж проваливается под пол', {
        labels: ['Баг'],
        status: 'wip',
        projectId: 'game',
        createdAt: '2026-11-19T08:00:00.000Z',
      }),
      testNote('hook', 'Крюк-кошка', {
        labels: ['Идея'],
        projectId: 'game',
        createdAt: '2026-11-18T08:00:00.000Z',
      }),
      testNote('leak', 'Утечка памяти', {
        labels: ['Баг', 'Фикс'],
        status: 'done',
        solution: 'Отписка от событий',
        projectId: 'site',
        createdAt: '2026-11-12T08:00:00.000Z',
      }),
      testNote('sprites', 'Спросить про спрайты', { createdAt: '2026-11-10T08:00:00.000Z' }),
    ],
  }
}

interface RenderOptions {
  data?: DataSnapshot
  /** Address after the "#", e.g. `/project/game`. */
  hash?: string
}

/** Renders the whole app on an in-memory store and waits until notes are loaded. */
export async function renderApp(options: RenderOptions = {}) {
  if (options.hash) window.location.hash = options.hash
  let counter = 0
  const newId = () => {
    counter += 1
    return `new-${counter}`
  }
  const dataStore = createMemoryStore({ initial: options.data ?? sampleData(), newId })
  const store = createAppStore({ dataStore, newId })
  const user = userEvent.setup()
  render(<AppRoot store={store} />)
  await screen.findByRole('navigation', { name: strings.nav.label })
  return { user, store, dataStore }
}

/** Titles of the note cards on screen, in display order. */
export function cardTitles(): string[] {
  return screen.queryAllByRole('article').map((card) => {
    const heading = card.querySelector('h2')
    return heading?.textContent ?? ''
  })
}

/** The card whose title is exactly `title`. Fails the test when there is none. */
export function cardByTitle(title: string): HTMLElement {
  const card = screen
    .queryAllByRole('article')
    .find((candidate) => candidate.querySelector('h2')?.textContent === title)
  if (!card)
    throw new Error(`No note card titled "${title}". On screen: ${cardTitles().join(' | ')}`)
  return card
}

export function sidebar(): HTMLElement {
  return screen.getByRole('navigation', { name: strings.nav.label })
}
