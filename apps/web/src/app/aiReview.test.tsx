import { AI_INSTRUCTION } from '@devnotes/core'
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { strings } from '../i18n'
import { cardTitles, renderApp, sampleData, sidebar, testNote } from '../test/renderApp'

type User = Awaited<ReturnType<typeof renderApp>>['user']

const AI_ANSWER = `Нашёл две проблемы, вот карточки:

\`\`\`json
{
  "devnotes": 1,
  "notes": [
    { "title": "Прыжок срабатывает во время анимации смерти",
      "body": "Что случилось: ввод не блокируется после смерти.",
      "labels": ["Баг"] },
    { "title": "Вынести параметры прыжка в настройки",
      "labels": ["Идея", "Настройки"], "status": "wip" }
  ]
}
\`\`\``

async function openPasteDialog(user: User) {
  await user.click(screen.getByRole('button', { name: strings.aiImport.button }))
  return screen.getByRole('dialog', { name: strings.aiImport.button })
}

/** Pastes text into the answer field at once, as a real paste does. */
function pasteAnswer(dialog: HTMLElement, text: string) {
  const field = within(dialog).getByRole('textbox', { name: strings.aiImport.step2Title })
  fireEvent.change(field, { target: { value: text } })
}

const reviewRegion = () => screen.getByRole('region', { name: strings.nav.review })
const reviewLink = () => within(sidebar()).getByRole('link', { name: /На проверку/ })

describe('paste from AI', () => {
  it('copies the instruction for the AI', async () => {
    const { user } = await renderApp()
    const dialog = await openPasteDialog(user)

    await user.click(within(dialog).getByRole('button', { name: strings.aiImport.copyInstruction }))

    expect(await navigator.clipboard.readText()).toBe(AI_INSTRUCTION)
    expect(within(dialog).getByText(strings.aiImport.instructionCopied)).toBeVisible()
  })

  it('turns the answer into cards for review in the chosen project', async () => {
    const { user, store } = await renderApp()
    const dialog = await openPasteDialog(user)
    pasteAnswer(dialog, AI_ANSWER)

    expect(within(dialog).getByText(/Распознано: 2 карточки/)).toBeVisible()
    expect(within(dialog).getByText(/Будут созданы метки: Настройки/)).toBeVisible()
    await user.click(within(dialog).getByRole('radio', { name: 'Платформер' }))
    await user.click(within(dialog).getByRole('button', { name: `${strings.aiImport.submit} (2)` }))

    expect(window.location.hash).toBe('#/review')
    const cards = within(reviewRegion()).getAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0] ?? reviewRegion()).getAllByText(strings.review.fromAi)).toHaveLength(1)
    expect(reviewRegion()).toHaveTextContent('Платформер · вставка от ИИ')
    expect(reviewLink()).toHaveTextContent('2')

    const saved = store.getState().notes.filter((note) => note.review === 'pending')
    expect(saved.map((note) => [note.source, note.projectId, note.status])).toEqual([
      ['ai_paste', 'game', 'new'],
      ['ai_paste', 'game', 'wip'],
    ])
    expect(store.getState().customLabels.map((label) => label.name)).toEqual(['Настройки'])

    // Cards on review are not in the grid, the counters or the search.
    await user.click(within(sidebar()).getByRole('link', { name: /Все заметки/ }))
    expect(cardTitles()).not.toContain('Вынести параметры прыжка в настройки')
    expect(within(sidebar()).getByRole('link', { name: /Все заметки/ })).toHaveTextContent('4')
  })

  it('explains an answer it cannot read and offers the instruction again', async () => {
    const { user } = await renderApp()
    const dialog = await openPasteDialog(user)

    pasteAnswer(dialog, 'Вот что я нашёл: меню паузы не закрывается.')

    expect(within(dialog).getByRole('alert')).toHaveTextContent(strings.aiImport.errors.noJson)
    expect(within(dialog).getByRole('alert')).toHaveTextContent(strings.aiImport.retry)
    expect(
      within(dialog).getByRole('button', { name: `${strings.aiImport.submit} (0)` }),
    ).toBeDisabled()

    pasteAnswer(dialog, '```json\n{"notes": [{"title": "a"}\n```')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(strings.aiImport.errors.invalidJson)
  })
})

describe('review', () => {
  function withReview() {
    return {
      ...sampleData(),
      notes: [
        ...sampleData().notes,
        testNote('ai1', 'Монеты не сохраняются', {
          labels: ['Баг'],
          projectId: 'game',
          review: 'pending',
          createdAt: '2026-11-19T08:30:00.000Z',
          ...({ source: 'ai_mcp' } as const),
        }),
        testNote('ai2', 'Вынести параметры в настройки', {
          labels: ['Идея'],
          review: 'pending',
          createdAt: '2026-11-19T08:20:00.000Z',
          ...({ source: 'ai_paste' } as const),
        }),
      ],
    }
  }

  it('shows the source of each card', async () => {
    await renderApp({ data: withReview(), hash: '/review' })
    expect(reviewRegion()).toHaveTextContent('Платформер · через Claude Code')
    expect(reviewRegion()).toHaveTextContent('Без проекта · вставка от ИИ')
  })

  it('accepts a card: it becomes an ordinary note and keeps its source', async () => {
    const { user, store } = await renderApp({ data: withReview(), hash: '/review' })

    const card = within(reviewRegion()).getByText('Монеты не сохраняются').closest('article')
    await user.click(
      within(card ?? reviewRegion()).getByRole('button', { name: strings.review.accept }),
    )

    expect(within(reviewRegion()).queryByText('Монеты не сохраняются')).toBeNull()
    expect(store.getState().notes.find((note) => note.id === 'ai1')).toMatchObject({
      review: null,
      source: 'ai_mcp',
    })

    await user.click(within(sidebar()).getByRole('link', { name: /Все заметки/ }))
    expect(cardTitles()).toContain('Монеты не сохраняются')
    await user.click(screen.getByRole('heading', { level: 2, name: 'Монеты не сохраняются' }))
    expect(screen.getByRole('dialog', { name: strings.note.dialogLabel })).toHaveTextContent(
      strings.note.createdByAi,
    )
  })

  it('lets the text be corrected before accepting', async () => {
    const { user } = await renderApp({ data: withReview(), hash: '/review' })
    await user.click(within(reviewRegion()).getByText('Монеты не сохраняются'))

    const dialog = screen.getByRole('dialog', { name: strings.note.dialogLabel })
    const title = within(dialog).getByRole('textbox', { name: strings.note.titleLabel })
    await user.clear(title)
    await user.type(title, 'Монеты пропадают при выходе в меню')
    await user.keyboard('{Escape}')

    expect(within(reviewRegion()).getByText('Монеты пропадают при выходе в меню')).toBeVisible()
  })

  it('accepts all cards at once', async () => {
    const { user } = await renderApp({ data: withReview(), hash: '/review' })
    await user.click(screen.getByRole('button', { name: `${strings.review.acceptAll} (2)` }))
    expect(screen.getByText(strings.review.empty)).toBeVisible()
    expect(reviewLink()).toHaveTextContent('0')
  })

  it('deletes all cards only after a confirmation, with "Undo"', async () => {
    const { user } = await renderApp({ data: withReview(), hash: '/review' })

    await user.click(screen.getByRole('button', { name: strings.review.deleteAll }))
    const confirm = screen.getByRole('dialog', { name: strings.review.deleteAllTitle })
    await user.click(within(confirm).getByRole('button', { name: strings.common.cancel }))
    expect(within(reviewRegion()).getAllByRole('article')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: strings.review.deleteAll }))
    await user.click(
      within(screen.getByRole('dialog', { name: strings.review.deleteAllTitle })).getByRole(
        'button',
        { name: strings.review.deleteAllConfirm },
      ),
    )
    expect(screen.getByText(strings.review.empty)).toBeVisible()

    await user.click(screen.getByRole('button', { name: strings.note.undo }))
    expect(within(reviewRegion()).getAllByRole('article')).toHaveLength(2)
  })
})
