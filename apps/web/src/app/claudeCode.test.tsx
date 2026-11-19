import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../i18n'
import { renderApp, sidebar } from '../test/renderApp'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('"Connect Claude Code" page', () => {
  it('gives one command with the package published next to the site', async () => {
    vi.stubEnv('VITE_DEVNOTES_MCP', '1')
    const { user } = await renderApp()

    await user.click(within(sidebar()).getByRole('link', { name: strings.claudeCode.link }))

    expect(screen.getByRole('heading', { level: 1, name: strings.claudeCode.title })).toBeVisible()
    await user.click(screen.getByRole('button', { name: strings.claudeCode.unix }))
    const command = screen.getByLabelText(strings.claudeCode.step2Title)
    expect(command).toHaveTextContent(
      `claude mcp add --transport stdio --scope user devnotes -- npx -y ${window.location.origin}/devnotes-mcp.tgz`,
    )

    await user.click(screen.getByRole('button', { name: strings.claudeCode.windows }))
    expect(command).toHaveTextContent('-- cmd /c npx -y')

    const copy = within(command.parentElement ?? document.body).getByRole('button', {
      name: strings.claudeCode.copy,
    })
    await user.click(copy)
    expect(await navigator.clipboard.readText()).toMatch(/^claude mcp add .* cmd \/c npx -y /)
    // The notes of the scope are not on this page.
    expect(screen.queryByRole('textbox', { name: strings.quickAdd.label })).toBeNull()
  })

  it('explains when the owner has not turned the MCP server on', async () => {
    vi.stubEnv('VITE_DEVNOTES_MCP', '')
    await renderApp({ hash: '/claude-code' })
    expect(screen.getByRole('note')).toHaveTextContent(strings.claudeCode.unavailable)
    expect(screen.queryByText(/claude mcp add/)).toBeNull()
  })
})
