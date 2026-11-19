import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { strings } from '../i18n'
import { cardByTitle, cardTitles, renderApp, sidebar } from '../test/renderApp'

const quickInput = () => screen.getByRole('textbox', { name: strings.quickAdd.label })

describe('projects', () => {
  it('creates a project from the sidebar and opens it', async () => {
    const { user } = await renderApp()
    const nav = within(sidebar())

    await user.click(nav.getByRole('button', { name: strings.project.new }))
    await user.type(nav.getByRole('textbox', { name: strings.project.nameLabel }), 'Шутер{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Шутер' })).toBeVisible()
    expect(nav.getByRole('link', { name: /^Шутер/ })).toHaveAttribute('aria-current', 'page')
    expect(cardTitles()).toEqual([])
    expect(screen.getByRole('radio', { name: 'Шутер' })).toBeChecked()

    await user.type(quickInput(), 'первый уровень{Enter}')
    expect(nav.getByRole('link', { name: /^Шутер/ })).toHaveTextContent(/1$/)
  })

  it('does not create a project without a name', async () => {
    const { user } = await renderApp()
    const nav = within(sidebar())

    await user.click(nav.getByRole('button', { name: strings.project.new }))
    await user.type(nav.getByRole('textbox', { name: strings.project.nameLabel }), '  {Enter}')

    expect(await nav.findByRole('alert')).toHaveTextContent(strings.project.errors.empty)
    // All, inbox, review, archive and the two projects: no new project appeared.
    expect(nav.getAllByRole('link')).toHaveLength(6)
  })

  it('renames a project', async () => {
    const { user } = await renderApp()

    await user.click(
      within(sidebar()).getByRole('button', { name: `${strings.project.settings}: Платформер` }),
    )
    const dialog = within(screen.getByRole('dialog', { name: strings.project.dialogTitle }))
    const name = dialog.getByRole('textbox', { name: strings.project.nameLabel })
    await user.clear(name)
    await user.type(name, 'Метроидвания')
    await user.click(dialog.getByRole('button', { name: strings.common.save }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(sidebar()).getByRole('link', { name: /^Метроидвания/ })).toBeVisible()
    expect(within(cardByTitle('Крюк-кошка')).getByText(/^Метроидвания · /)).toBeVisible()
  })

  it('removes a project from the list together with its notes and leaves the open project', async () => {
    const { user, dataStore } = await renderApp({ hash: '/project/game' })
    await screen.findByRole('heading', { level: 1, name: 'Платформер' })

    await user.click(
      within(sidebar()).getByRole('button', { name: `${strings.project.settings}: Платформер` }),
    )
    await user.click(screen.getByRole('button', { name: strings.project.remove }))

    expect(await screen.findByRole('heading', { level: 1, name: strings.nav.all })).toBeVisible()
    expect(within(sidebar()).queryByRole('link', { name: /^Платформер/ })).not.toBeInTheDocument()
    expect(cardTitles()).toEqual(['Утечка памяти', 'Спросить про спрайты'])
    expect(screen.queryByRole('radio', { name: 'Платформер' })).not.toBeInTheDocument()

    // The project is only hidden: nothing is erased from storage.
    const saved = await dataStore.load()
    expect(saved.projects.find((project) => project.id === 'game')?.removed).toBe(true)
    expect(saved.notes.filter((note) => note.projectId === 'game')).toHaveLength(2)
  })

  it('falls back to all notes for an address of an unknown project', async () => {
    await renderApp({ hash: '/project/no-such-project' })

    expect(await screen.findByRole('heading', { level: 1, name: strings.nav.all })).toBeVisible()
    expect(cardTitles()).toHaveLength(4)
  })
})

describe('own labels', () => {
  async function createLabel(user: Awaited<ReturnType<typeof renderApp>>['user'], name: string) {
    await user.click(within(sidebar()).getByRole('button', { name: strings.label.new }))
    const dialog = within(screen.getByRole('dialog', { name: strings.label.newTitle }))
    await user.type(dialog.getByRole('textbox', { name: strings.label.nameLabel }), name)
    await user.click(dialog.getByRole('radio', { name: strings.label.colors.teal }))
    await user.click(dialog.getByRole('button', { name: strings.common.create }))
  }

  it('creates a label that then works in quick input and as a filter', async () => {
    const { user, dataStore } = await renderApp()

    await createLabel(user, 'Звук')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await dataStore.load()).labels).toMatchObject([{ name: 'Звук', color: 'teal' }])

    await user.type(quickInput(), 'звук: шаги по траве{Enter}')
    expect(within(cardByTitle('шаги по траве')).getByText('Звук')).toBeVisible()

    await user.click(within(sidebar()).getByRole('button', { name: /^Звук/ }))
    expect(cardTitles()).toEqual(['шаги по траве'])
  })

  it('refuses a duplicate name, including built-in labels', async () => {
    const { user } = await renderApp()

    await createLabel(user, 'баг')

    const dialog = within(screen.getByRole('dialog', { name: strings.label.newTitle }))
    expect(dialog.getByRole('alert')).toHaveTextContent(strings.label.errors.duplicate)
  })

  it('renames and recolors a label on every note without reordering them', async () => {
    const { user, dataStore } = await renderApp()
    await createLabel(user, 'Звук')
    await user.type(quickInput(), 'звук: шаги{Enter}')
    await user.type(quickInput(), 'ещё заметка{Enter}')
    const order = cardTitles()

    await user.click(within(sidebar()).getByRole('button', { name: `${strings.label.edit}: Звук` }))
    const dialog = within(screen.getByRole('dialog', { name: strings.label.editTitle }))
    const name = dialog.getByRole('textbox', { name: strings.label.nameLabel })
    await user.clear(name)
    await user.type(name, 'Аудио')
    await user.click(dialog.getByRole('radio', { name: strings.label.colors.pink }))
    await user.click(dialog.getByRole('button', { name: strings.common.save }))

    expect(within(cardByTitle('шаги')).getByText('Аудио')).toBeVisible()
    expect(within(sidebar()).getByRole('button', { name: /^Аудио/ })).toBeVisible()
    expect(cardTitles()).toEqual(order)
    const saved = await dataStore.load()
    expect(saved.labels).toMatchObject([{ name: 'Аудио', color: 'pink' }])
    expect(saved.notes.find((note) => note.title === 'шаги')?.labels).toEqual(['Аудио'])
  })

  it('deletes a label after a confirmation and takes it off the notes', async () => {
    const { user } = await renderApp()
    await createLabel(user, 'Звук')
    await user.type(quickInput(), 'звук: шаги{Enter}')
    await user.click(within(sidebar()).getByRole('button', { name: /^Звук/ }))

    await user.click(within(sidebar()).getByRole('button', { name: `${strings.label.edit}: Звук` }))
    const dialog = within(screen.getByRole('dialog', { name: strings.label.editTitle }))
    await user.click(dialog.getByRole('button', { name: strings.label.delete }))
    expect(cardTitles()).toEqual(['шаги'])
    await user.click(dialog.getByRole('button', { name: strings.label.deleteConfirmButton }))

    expect(within(sidebar()).queryByRole('button', { name: /^Звук/ })).not.toBeInTheDocument()
    expect(within(cardByTitle('шаги')).queryByText('Звук')).not.toBeInTheDocument()
    // The filter by the deleted label is dropped, so all notes are back.
    expect(cardTitles()).toHaveLength(5)
  })

  it('offers no editing for built-in labels', async () => {
    await renderApp()

    expect(
      within(sidebar()).queryByRole('button', { name: new RegExp(`^${strings.label.edit}`) }),
    ).not.toBeInTheDocument()
  })
})
