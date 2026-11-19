import { BUG_TEMPLATE } from '@devnotes/core'
import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { strings } from '../i18n'
import { cardByTitle, cardTitles, renderApp, sampleData, testNote } from '../test/renderApp'

type User = Awaited<ReturnType<typeof renderApp>>['user']

const noteDialog = () => screen.getByRole('dialog', { name: strings.note.dialogLabel })

async function openNote(user: User, title: string) {
  await user.click(within(cardByTitle(title)).getByRole('button', { name: strings.note.open }))
  return noteDialog()
}

async function selectCard(user: User, title: string) {
  await user.click(
    within(cardByTitle(title)).getByRole('checkbox', {
      name: `${strings.selection.select}: ${title}`,
    }),
  )
}

afterEach(() => {
  localStorage.clear()
})

describe('bug template', () => {
  it('fills the empty text when the "Баг" label is added in the dialog', async () => {
    const { user } = await renderApp()
    const dialog = await openNote(user, 'Спросить про спрайты')

    await user.click(within(dialog).getByRole('button', { name: strings.note.addLabel }))
    await user.click(within(dialog).getByRole('button', { name: 'Баг' }))

    expect(within(dialog).getByRole('textbox', { name: strings.note.bodyLabel })).toHaveValue(
      BUG_TEMPLATE,
    )
  })

  it('fills a note made with the "баг:" prefix', async () => {
    const { user } = await renderApp()
    await user.type(
      screen.getByRole('textbox', { name: strings.quickAdd.label }),
      'баг: Падает{Enter}',
    )

    const dialog = await openNote(user, 'Падает')
    expect(within(dialog).getByRole('textbox', { name: strings.note.bodyLabel })).toHaveValue(
      BUG_TEMPLATE,
    )
  })
})

describe('"how I fixed it"', () => {
  it('appears when a bug is done, adds "Фикс" and is found by search', async () => {
    const { user } = await renderApp()
    const dialog = await openNote(user, 'Персонаж проваливается под пол')
    expect(within(dialog).queryByRole('textbox', { name: strings.solution.title })).toBeNull()

    await user.click(
      within(dialog).getByRole('button', { name: `${strings.status.label}: В разработке` }),
    )
    const field = within(dialog).getByRole('textbox', { name: strings.solution.title })
    await user.type(field, 'Утолщил коллайдер')

    expect(within(dialog).getByText('Фикс')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(
      within(cardByTitle('Персонаж проваливается под пол')).getByText(/Утолщил коллайдер/),
    ).toBeVisible()

    await user.type(screen.getByRole('searchbox', { name: strings.search.label }), 'коллайдер')
    expect(cardTitles()).toEqual(['Персонаж проваливается под пол'])
  })
})

describe('board', () => {
  it('shows three columns by status with counters, for the current filter too', async () => {
    const { user } = await renderApp()
    await user.click(screen.getByRole('button', { name: strings.view.board }))

    const board = screen.getByRole('region', { name: strings.board.label })
    const column = (name: string, count: number) =>
      within(board).getByRole('region', { name: `${name}: ${String(count)}` })
    expect(within(column('Новое', 2)).getAllByRole('article')).toHaveLength(2)
    expect(
      within(column('В разработке', 1)).getByText('Персонаж проваливается под пол'),
    ).toBeVisible()
    expect(within(column('Готово', 1)).getByText('Утечка памяти')).toBeVisible()
    expect(screen.getByText(strings.board.hint)).toBeVisible()

    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Идея/ }))
    expect(within(board).getAllByRole('article')).toHaveLength(1)
    expect(column('Готово', 0)).toBeVisible()
  })

  it('remembers the chosen view', async () => {
    const { user } = await renderApp()
    await user.click(screen.getByRole('button', { name: strings.view.board }))
    expect(localStorage.getItem('devnotes.view')).toBe('board')
  })

  it('changes the status with the store action used on drop', async () => {
    const { user, store } = await renderApp()
    await user.click(screen.getByRole('button', { name: strings.view.board }))

    store.getState().actions.setStatus('hook', 'wip')

    const board = screen.getByRole('region', { name: strings.board.label })
    expect(await within(board).findByRole('region', { name: 'В разработке: 2' })).toHaveTextContent(
      'Крюк-кошка',
    )
  })
})

describe('selecting several notes', () => {
  it('selects with checkboxes, then a click on a card selects instead of opening', async () => {
    const { user } = await renderApp()
    await selectCard(user, 'Крюк-кошка')

    const bar = screen.getByRole('region', { name: `${strings.selection.selected}: 1` })
    await user.click(cardByTitle('Утечка памяти'))

    expect(screen.queryByRole('dialog', { name: strings.note.dialogLabel })).toBeNull()
    expect(screen.getByRole('region', { name: `${strings.selection.selected}: 2` })).toBe(bar)

    await user.click(within(bar).getByRole('button', { name: strings.selection.clear }))
    expect(screen.queryByRole('region', { name: /Выбрано/ })).toBeNull()
  })

  it('archives the selected notes', async () => {
    const { user } = await renderApp()
    await selectCard(user, 'Крюк-кошка')
    await selectCard(user, 'Спросить про спрайты')

    await user.click(screen.getByRole('button', { name: strings.selection.archive }))

    expect(cardTitles()).toEqual(['Персонаж проваливается под пол', 'Утечка памяти'])
  })

  it('deletes the selected notes with one "Undo"', async () => {
    const { user } = await renderApp()
    await selectCard(user, 'Крюк-кошка')
    await selectCard(user, 'Утечка памяти')

    await user.click(screen.getByRole('button', { name: strings.selection.delete }))
    expect(cardTitles()).toEqual(['Персонаж проваливается под пол', 'Спросить про спрайты'])

    await user.click(screen.getByRole('button', { name: strings.note.undo }))
    expect(cardTitles()).toHaveLength(4)
  })
})

describe('copy for AI', () => {
  it('builds the text from the selected notes and copies it', async () => {
    const { user } = await renderApp({
      data: {
        ...sampleData(),
        notes: [
          testNote('a', 'Персонаж проваливается под пол', {
            labels: ['Баг'],
            body: 'Что случилось: проходит сквозь пол.',
            projectId: 'game',
            createdAt: '2026-11-19T08:00:00.000Z',
          }),
          testNote('b', 'Крюк-кошка', {
            labels: ['Идея'],
            projectId: 'game',
            createdAt: '2026-11-18T08:00:00.000Z',
          }),
          testNote('c', 'Лишняя', { projectId: 'game', createdAt: '2026-11-17T08:00:00.000Z' }),
        ],
      },
    })
    await selectCard(user, 'Крюк-кошка')
    await selectCard(user, 'Персонаж проваливается под пол')
    await user.click(
      within(screen.getByRole('region', { name: /Выбрано/ })).getByRole('button', {
        name: strings.aiCopy.button,
      }),
    )

    const dialog = screen.getByRole('dialog', { name: strings.aiCopy.button })
    const preview = within(dialog).getByRole('textbox', { name: strings.aiCopy.preview })
    expect(preview).toHaveValue(
      [
        'Проект: Платформер',
        'Нужно исправить 1 баг и оценить 1 идею.',
        '',
        'БАГ. Персонаж проваливается под пол',
        'Что случилось: проходит сквозь пол.',
        '',
        'ИДЕЯ. Крюк-кошка',
      ].join('\n'),
    )

    await user.click(within(dialog).getByRole('checkbox', { name: /Крюк-кошка/ }))
    expect((preview as HTMLTextAreaElement).value).not.toContain('ИДЕЯ')

    await user.click(within(dialog).getByRole('button', { name: strings.aiCopy.copy }))
    expect(await navigator.clipboard.readText()).toMatch(
      /^Проект: Платформер\nНужно исправить 1 баг\./,
    )
    expect(within(dialog).getByText(strings.aiCopy.copied)).toBeVisible()
  })

  it('takes every note on screen from the header button', async () => {
    const { user } = await renderApp({ hash: '/project/game' })
    await user.click(screen.getByRole('button', { name: strings.aiCopy.button }))

    const dialog = screen.getByRole('dialog', { name: strings.aiCopy.button })
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(dialog).getByText(/Выбрано: 2 заметки/)).toBeVisible()
  })
})
