import { describe, expect, it } from 'vitest'
import { allLabels } from './labels'
import { parseQuickInput } from './quickAdd'

const labels = allLabels([
  { name: 'Звук шагов', color: 'teal', createdAt: '2026-11-01T00:00:00.000Z' },
])

describe('parseQuickInput', () => {
  it('keeps plain text as the title', () => {
    expect(parseQuickInput('  Спросить про спрайты  ', labels)).toEqual({
      title: 'Спросить про спрайты',
      label: null,
    })
  })

  it('recognises built-in labels by Russian name in any case', () => {
    expect(parseQuickInput('баг: меню не закрывается', labels)).toEqual({
      title: 'меню не закрывается',
      label: 'Баг',
    })
    expect(parseQuickInput('ИДЕЯ:крюк-кошка', labels)).toEqual({
      title: 'крюк-кошка',
      label: 'Идея',
    })
    expect(parseQuickInput('Фикс : отписка от событий', labels).label).toBe('Фикс')
  })

  it('recognises English aliases of built-in labels', () => {
    expect(parseQuickInput('bug: crash', labels)).toEqual({ title: 'crash', label: 'Баг' })
    expect(parseQuickInput('Idea: grappling hook', labels).label).toBe('Идея')
    expect(parseQuickInput('FIX: unsubscribe', labels).label).toBe('Фикс')
  })

  it('recognises the user’s own labels, including names with spaces', () => {
    expect(parseQuickInput('звук шагов: трава и камень', labels)).toEqual({
      title: 'трава и камень',
      label: 'Звук шагов',
    })
  })

  it('does not treat an unknown prefix as a label', () => {
    expect(parseQuickInput('Баланс колоды: стартовые карты', labels)).toEqual({
      title: 'Баланс колоды: стартовые карты',
      label: null,
    })
  })

  it('only looks at the first colon', () => {
    expect(parseQuickInput('баг: время 12:30 сбрасывается', labels).title).toBe(
      'время 12:30 сбрасывается',
    )
  })

  it('returns an empty title when there is nothing after the prefix', () => {
    expect(parseQuickInput('баг:   ', labels)).toEqual({ title: '', label: 'Баг' })
    expect(parseQuickInput('   ', labels)).toEqual({ title: '', label: null })
  })

  it('cuts the title to 200 characters', () => {
    expect(parseQuickInput(`баг: ${'я'.repeat(300)}`, labels).title).toHaveLength(200)
  })
})
