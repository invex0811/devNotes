import { describe, expect, it } from 'vitest'
import { hasChecklist, parseBody, toggleChecklistLine } from './checklist'

const body = 'Перед релизом:\n[ ] проверить геймпад\n[x] обновить иконку\nготово [x] не пункт'

describe('parseBody', () => {
  it('recognises checklist items only at the start of a line', () => {
    expect(parseBody(body)).toEqual([
      { kind: 'text', line: 0, text: 'Перед релизом:' },
      { kind: 'item', line: 1, text: 'проверить геймпад', checked: false },
      { kind: 'item', line: 2, text: 'обновить иконку', checked: true },
      { kind: 'text', line: 3, text: 'готово [x] не пункт' },
    ])
  })

  it('returns nothing for an empty body', () => {
    expect(parseBody('')).toEqual([])
    expect(hasChecklist('')).toBe(false)
    expect(hasChecklist(body)).toBe(true)
  })
})

describe('toggleChecklistLine', () => {
  it('flips an item and leaves the rest of the text intact', () => {
    const once = toggleChecklistLine(body, 1)
    expect(once.split('\n')[1]).toBe('[x] проверить геймпад')
    expect(toggleChecklistLine(once, 1)).toBe(body)
    expect(toggleChecklistLine(body, 2).split('\n')[2]).toBe('[ ] обновить иконку')
  })

  it('ignores lines that are not items and lines that do not exist', () => {
    expect(toggleChecklistLine(body, 0)).toBe(body)
    expect(toggleChecklistLine(body, 3)).toBe(body)
    expect(toggleChecklistLine(body, 99)).toBe(body)
  })
})
