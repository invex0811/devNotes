import { describe, expect, it } from 'vitest'
import {
  allLabels,
  findLabel,
  hasLabel,
  removeLabelFromList,
  renameLabelInList,
  toggleLabel,
  validateLabelName,
  type CustomLabel,
} from './labels'

const custom: CustomLabel[] = [
  { name: 'Звук', color: 'teal', createdAt: '2026-11-02T00:00:00.000Z' },
  { name: 'Арт', color: 'pink', createdAt: '2026-11-01T00:00:00.000Z' },
]

describe('allLabels', () => {
  it('puts built-in labels first, then own labels in creation order', () => {
    expect(allLabels(custom).map((label) => label.name)).toEqual([
      'Идея',
      'Баг',
      'Фикс',
      'Арт',
      'Звук',
    ])
  })

  it('ignores an own label that collides with a built-in one', () => {
    const labels = allLabels([
      { name: 'баг', color: 'green', createdAt: custom[0]?.createdAt ?? '' },
    ])
    expect(labels).toHaveLength(3)
    expect(findLabel(labels, 'БАГ')).toMatchObject({ color: 'red', builtin: true })
  })
})

describe('validateLabelName', () => {
  const labels = allLabels(custom)

  it('rejects empty and too long names', () => {
    expect(validateLabelName('   ', labels)).toBe('empty')
    expect(validateLabelName('a'.repeat(41), labels)).toBe('too_long')
  })

  it('rejects duplicates regardless of case, including built-in aliases', () => {
    expect(validateLabelName('арт', labels)).toBe('duplicate')
    expect(validateLabelName('Баг', labels)).toBe('duplicate')
    expect(validateLabelName('Bug', labels)).toBe('duplicate')
  })

  it('accepts a new name and the own name of the label being renamed', () => {
    expect(validateLabelName('Уровни', labels)).toBeNull()
    expect(validateLabelName('АРТ', labels, 'Арт')).toBeNull()
    expect(validateLabelName('Звук', labels, 'Арт')).toBe('duplicate')
  })
})

describe('label lists on a note', () => {
  it('matches, toggles, renames and removes labels case-insensitively', () => {
    expect(hasLabel(['Баг'], 'баг')).toBe(true)
    expect(toggleLabel(['Баг'], 'БАГ')).toEqual([])
    expect(toggleLabel(['Баг'], 'Фикс')).toEqual(['Баг', 'Фикс'])
    expect(renameLabelInList(['арт', 'Баг'], 'Арт', 'Графика')).toEqual(['Графика', 'Баг'])
    expect(removeLabelFromList(['арт', 'Баг'], 'Арт')).toEqual(['Баг'])
  })
})
