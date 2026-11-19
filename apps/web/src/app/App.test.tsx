import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { strings } from '../i18n'
import { App } from './App'

describe('App shell', () => {
  it('renders the logo, the page title and the main area', () => {
    render(<App />)

    expect(screen.getByText(strings.appName)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: strings.shell.allNotes })).toBeVisible()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: strings.shell.sidebarLabel })).toBeVisible()
  })
})
