import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { strings } from '../i18n'
import { App } from './App'

describe('App', () => {
  it('without ?demo=1 shows the welcome page with a link to the demo', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: strings.welcome.title })).toBeVisible()
    expect(screen.getByRole('link', { name: strings.welcome.openDemo })).toHaveAttribute(
      'href',
      '?demo=1',
    )
  })

  it('with ?demo=1 opens the app with sample notes and no Google', async () => {
    window.history.replaceState(null, '', '/?demo=1')
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: strings.nav.all })).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(9)
    expect(screen.getByText(strings.demo.title)).toBeVisible()
  })
})
