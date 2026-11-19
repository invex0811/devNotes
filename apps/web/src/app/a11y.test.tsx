import { fireEvent, render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { CacheDb } from '../data/google/cache'
import { createGoogleSession } from '../data/google/session'
import { strings } from '../i18n'
import { FakeGoogle } from '../test/fakeGoogle'
import { cardByTitle, renderApp, sampleData, testNote } from '../test/renderApp'
import { SessionApp } from './GoogleApp'

/**
 * Accessibility rules that work without a real layout: names of controls, roles,
 * labels, landmarks and ARIA. Colour contrast needs real rendering and is checked
 * against the design tokens instead (all text pairs are at least 5:1).
 */
async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    resultTypes: ['violations'],
  })
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  )
}

describe('accessibility', () => {
  it('the grid, the sidebar and the header', async () => {
    await renderApp()
    expect(await violations()).toEqual([])
  })

  it('the note dialog with "how I fixed it"', async () => {
    const { user } = await renderApp()
    await user.click(
      within(cardByTitle('Утечка памяти')).getByRole('button', { name: strings.note.open }),
    )
    expect(await violations()).toEqual([])
  })

  it('the board', async () => {
    const { user } = await renderApp()
    await user.click(screen.getByRole('button', { name: strings.view.board }))
    expect(await violations()).toEqual([])
  })

  it('"Copy for AI" and "Paste from AI"', async () => {
    const { user } = await renderApp()
    await user.click(screen.getByRole('button', { name: strings.aiCopy.button }))
    expect(await violations()).toEqual([])
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: strings.aiImport.button }))
    const dialog = screen.getByRole('dialog', { name: strings.aiImport.button })
    fireEvent.change(within(dialog).getByRole('textbox', { name: strings.aiImport.step2Title }), {
      target: { value: '{"notes":[{"title":"Карточка","labels":["Баг"]}]}' },
    })
    expect(await violations()).toEqual([])
  })

  it('the review page', async () => {
    await renderApp({
      hash: '/review',
      data: {
        ...sampleData(),
        notes: [testNote('ai', 'От ИИ', { review: 'pending', labels: ['Баг'] })],
      },
    })
    expect(await violations()).toEqual([])
  })

  it('the sign-in page', async () => {
    const session = createGoogleSession({
      tokens: {
        ready: () => Promise.resolve(),
        getToken: () => null,
        request: () => Promise.resolve(),
        revoke: () => Promise.resolve(),
      },
      api: new FakeGoogle(),
      db: new CacheDb('a11y-sign-in'),
      reload: vi.fn(),
    })
    render(<SessionApp session={session} />)
    await screen.findByRole('button', { name: strings.signIn.button })
    expect(await violations()).toEqual([])
  })
})
