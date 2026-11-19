import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeleteToast } from '../features/notes/DeleteToast'
import { createMemoryStore } from '../data/memoryStore'
import { strings } from '../i18n'
import { createAppStore, UNDO_TIMEOUT_MS } from '../store/appStore'
import { AppStoreProvider } from '../store/AppStoreProvider'
import {
  cardByTitle,
  cardTitles,
  renderApp,
  sampleData,
  sidebar,
  testNote,
} from '../test/renderApp'

const quickInput = () => screen.getByRole('textbox', { name: strings.quickAdd.label })
const statusButton = (name: string) => ({ name: `${strings.status.label}: ${name}` })

async function openNote(user: Awaited<ReturnType<typeof renderApp>>['user'], title: string) {
  await user.click(within(cardByTitle(title)).getByRole('button', { name: strings.note.open }))
  return screen.getByRole('dialog', { name: strings.note.dialogLabel })
}

describe('grid', () => {
  it('shows notes newest first with title, status, labels, project and date', async () => {
    await renderApp()

    expect(cardTitles()).toEqual([
      'Персонаж проваливается под пол',
      'Крюк-кошка',
      'Утечка памяти',
      'Спросить про спрайты',
    ])
    const card = within(cardByTitle('Утечка памяти'))
    expect(card.getByRole('button', statusButton('Готово'))).toBeVisible()
    expect(card.getByText('Баг')).toBeVisible()
    expect(card.getByText('Фикс')).toBeVisible()
    expect(card.getByText(/^Сайт студии · /)).toBeVisible()
    expect(within(cardByTitle('Спросить про спрайты')).getByText(/^Без проекта · /)).toBeVisible()
  })

  it('puts pinned notes first', async () => {
    const data = sampleData()
    const oldest = data.notes.find((note) => note.id === 'sprites')
    if (oldest) oldest.pinned = true
    await renderApp({ data })

    expect(cardTitles()[0]).toBe('Спросить про спрайты')
    expect(
      within(cardByTitle('Спросить про спрайты')).getByRole('img', { name: strings.note.pinned }),
    ).toBeVisible()
  })

  it('ticks checklist items right on the card', async () => {
    const data = sampleData()
    data.notes.push(testNote('list', 'Перед релизом', { body: '[ ] геймпад\n[x] иконка' }))
    const { user, store } = await renderApp({ data })

    const card = within(cardByTitle('Перед релизом'))
    const first = card.getByRole('checkbox', { name: 'геймпад' })
    expect(first).not.toBeChecked()
    expect(card.getByRole('checkbox', { name: 'иконка' })).toBeChecked()

    await user.click(first)

    expect(card.getByRole('checkbox', { name: 'геймпад' })).toBeChecked()
    expect(store.getState().notes.find((note) => note.id === 'list')?.body).toBe(
      '[x] геймпад\n[x] иконка',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('quick add', () => {
  it('saves a note on Enter and sets the label from the prefix', async () => {
    const { user } = await renderApp()

    await user.type(quickInput(), 'баг: падает при старте')
    expect(screen.getByText(strings.quickAdd.willLabel)).toBeVisible()
    await user.keyboard('{Enter}')

    expect(quickInput()).toHaveValue('')
    expect(cardTitles()[0]).toBe('падает при старте')
    const card = within(cardByTitle('падает при старте'))
    expect(card.getByText('Баг')).toBeVisible()
    expect(card.getByRole('button', statusButton('Новое'))).toBeVisible()
    expect(card.getByText('Без проекта · сегодня')).toBeVisible()
  })

  it('sends a note without a label to the inbox', async () => {
    const { user } = await renderApp()

    await user.type(quickInput(), 'просто мысль{Enter}')
    await user.click(within(sidebar()).getByRole('link', { name: /^Входящие/ }))

    expect(await screen.findByRole('heading', { level: 1, name: strings.nav.inbox })).toBeVisible()
    expect(cardTitles()).toEqual(['просто мысль', 'Спросить про спрайты'])
  })

  it('does not create a note from an empty input or a bare prefix', async () => {
    const { user } = await renderApp()

    await user.type(quickInput(), '   {Enter}')
    await user.clear(quickInput())
    await user.type(quickInput(), 'баг: {Enter}')

    expect(cardTitles()).toHaveLength(4)
  })

  it('offers the open project by default and "no project" elsewhere', async () => {
    const { user } = await renderApp({ hash: '/project/game' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Платформер' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Платформер' })).toBeChecked()

    await user.type(quickInput(), 'идея: двойной прыжок{Enter}')
    expect(within(cardByTitle('двойной прыжок')).getByText('Платформер · сегодня')).toBeVisible()

    await user.click(within(sidebar()).getByRole('link', { name: /^Все заметки/ }))
    expect(await screen.findByRole('radio', { name: strings.project.none })).toBeChecked()
  })
})

describe('statuses, filters and search', () => {
  it('cycles the status by clicking the badge, without opening the note', async () => {
    const { user } = await renderApp()
    const card = within(cardByTitle('Крюк-кошка'))

    await user.click(card.getByRole('button', statusButton('Новое')))
    expect(card.getByRole('button', statusButton('В разработке'))).toBeVisible()
    await user.click(card.getByRole('button', statusButton('В разработке')))
    await user.click(card.getByRole('button', statusButton('Готово')))

    expect(card.getByRole('button', statusButton('Новое'))).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('filters by a label and a status from the sidebar; a second click removes the filter', async () => {
    const { user } = await renderApp()
    const nav = within(sidebar())

    await user.click(nav.getByRole('button', { name: /^Баг/ }))
    expect(nav.getByRole('button', { name: /^Баг/ })).toHaveAttribute('aria-pressed', 'true')
    expect(cardTitles()).toEqual(['Персонаж проваливается под пол', 'Утечка памяти'])

    await user.click(nav.getByRole('button', { name: /^Готово/ }))
    expect(cardTitles()).toEqual(['Утечка памяти'])

    await user.click(nav.getByRole('button', { name: /^Баг/ }))
    await user.click(nav.getByRole('button', { name: /^Готово/ }))
    expect(cardTitles()).toHaveLength(4)
  })

  it('counts statuses and labels inside the current scope', async () => {
    const { user } = await renderApp()
    const nav = within(sidebar())

    expect(nav.getByRole('link', { name: /^Все заметки/ })).toHaveTextContent(/4$/)
    expect(nav.getByRole('link', { name: /^Входящие/ })).toHaveTextContent(/1$/)
    expect(nav.getByRole('link', { name: /^Платформер/ })).toHaveTextContent(/2$/)
    expect(nav.getByRole('button', { name: /^Баг/ })).toHaveTextContent(/2$/)
    expect(nav.getByRole('button', { name: /^Новое/ })).toHaveTextContent(/2$/)

    await user.click(nav.getByRole('link', { name: /^Платформер/ }))
    await screen.findByRole('heading', { level: 1, name: 'Платформер' })

    expect(cardTitles()).toEqual(['Персонаж проваливается под пол', 'Крюк-кошка'])
    expect(nav.getByRole('button', { name: /^Баг/ })).toHaveTextContent(/1$/)
    expect(nav.getByRole('button', { name: /^Готово/ })).toHaveTextContent(/0$/)
  })

  it('searches title, text and solution as you type, inside the scope', async () => {
    const { user } = await renderApp()
    const search = screen.getByRole('searchbox', { name: strings.search.label })

    await user.type(search, 'ОТПИСКА')
    expect(cardTitles()).toEqual(['Утечка памяти'])

    await user.click(screen.getByRole('button', { name: strings.search.clear }))
    await user.type(search, 'нет такого текста')
    expect(screen.getByText(strings.grid.nothingFound)).toBeVisible()

    await user.clear(search)
    await user.type(search, 'утечка')
    await user.click(within(sidebar()).getByRole('link', { name: /^Платформер/ }))
    await screen.findByRole('heading', { level: 1, name: 'Платформер' })
    expect(cardTitles()).toEqual([])
  })
})

describe('note dialog', () => {
  it('edits a note with automatic saving', async () => {
    const { user, dataStore } = await renderApp()
    const dialog = within(await openNote(user, 'Спросить про спрайты'))

    const title = dialog.getByRole('textbox', { name: strings.note.titleLabel })
    await user.clear(title)
    await user.type(title, 'Размер спрайтов')
    await user.type(dialog.getByRole('textbox', { name: strings.note.bodyLabel }), '64 на 64')
    await user.click(dialog.getByRole('button', statusButton('Новое')))
    await user.click(dialog.getByRole('button', { name: strings.note.addLabel }))
    await user.click(
      within(dialog.getByRole('group', { name: strings.note.labelsPanel })).getByRole('button', {
        name: 'Идея',
      }),
    )
    await user.click(dialog.getByRole('radio', { name: strings.note.colors.violet }))
    await user.click(dialog.getByRole('button', { name: strings.note.pin }))
    await user.selectOptions(dialog.getByRole('combobox'), 'Сайт студии')
    await user.click(dialog.getByRole('button', { name: strings.common.close }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cardTitles()[0]).toBe('Размер спрайтов')
    const card = within(cardByTitle('Размер спрайтов'))
    expect(card.getByText('64 на 64')).toBeVisible()
    expect(card.getByRole('button', statusButton('В разработке'))).toBeVisible()
    expect(card.getByText('Идея')).toBeVisible()
    expect(card.getByRole('img', { name: strings.note.pinned })).toBeVisible()
    expect(card.getByText('Сайт студии · сегодня')).toBeVisible()

    const saved = (await dataStore.load()).notes.find((note) => note.id === 'sprites')
    expect(saved).toMatchObject({
      title: 'Размер спрайтов',
      body: '64 на 64',
      status: 'wip',
      labels: ['Идея'],
      color: 'violet',
      pinned: true,
      projectId: 'site',
    })
  })

  it('shows checklist lines of the text as checkboxes', async () => {
    const { user } = await renderApp()
    const dialog = within(await openNote(user, 'Крюк-кошка'))
    const body = dialog.getByRole('textbox', { name: strings.note.bodyLabel })

    await user.click(body)
    await user.paste('План:\n[ ] прототип\n[ ] уровень')
    await user.click(dialog.getByRole('checkbox', { name: 'прототип' }))

    expect(body).toHaveValue('План:\n[x] прототип\n[ ] уровень')
  })

  it('deletes without confirmation and lets the user undo', async () => {
    const { user } = await renderApp()
    const dialog = within(await openNote(user, 'Крюк-кошка'))

    await user.click(dialog.getByRole('button', { name: strings.note.delete }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cardTitles()).not.toContain('Крюк-кошка')
    expect(screen.getByText(strings.note.deleted)).toBeVisible()

    await user.click(screen.getByRole('button', { name: strings.note.undo }))

    expect(cardTitles()).toContain('Крюк-кошка')
    expect(screen.queryByText(strings.note.deleted)).not.toBeInTheDocument()
  })

  it('moves a note to the archive and back', async () => {
    const { user } = await renderApp()
    const nav = within(sidebar())

    const dialog = within(await openNote(user, 'Крюк-кошка'))
    await user.click(dialog.getByRole('button', { name: strings.note.archive }))
    expect(cardTitles()).not.toContain('Крюк-кошка')
    expect(nav.getByRole('link', { name: /^Все заметки/ })).toHaveTextContent(/3$/)

    await user.click(nav.getByRole('link', { name: /^Архив/ }))
    await screen.findByRole('heading', { level: 1, name: strings.nav.archive })
    expect(cardTitles()).toEqual(['Крюк-кошка'])
    expect(screen.queryByRole('textbox', { name: strings.quickAdd.label })).not.toBeInTheDocument()

    const archived = within(await openNote(user, 'Крюк-кошка'))
    await user.click(archived.getByRole('button', { name: strings.note.unarchive }))
    expect(screen.getByText(strings.grid.emptyArchive)).toBeVisible()
  })
})

describe('delete message', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('disappears by itself after five seconds', async () => {
    vi.useFakeTimers()
    const store = createAppStore({ dataStore: createMemoryStore({ initial: sampleData() }) })
    await store.getState().actions.load()
    render(
      <AppStoreProvider store={store}>
        <DeleteToast />
      </AppStoreProvider>,
    )

    act(() => {
      store.getState().actions.deleteNote('hook')
    })
    expect(screen.getByText(strings.note.deleted)).toBeVisible()

    act(() => {
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS - 1)
    })
    expect(screen.getByText(strings.note.deleted)).toBeVisible()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText(strings.note.deleted)).not.toBeInTheDocument()
    expect(store.getState().notes.find((note) => note.id === 'hook')?.deleted).toBe(true)
  })
})
