import { describe, expect, it } from 'vitest'
import { BUG_TEMPLATE, applyBugRules, showsSolution } from './bugs'
import { makeNote } from './testing'

describe('bug template', () => {
  it('fills the empty text when the "Баг" label is added', () => {
    const before = makeNote()
    const after = applyBugRules(before, { ...before, labels: ['Баг'] })
    expect(after.body).toBe(BUG_TEMPLATE)
    expect(after.body.split('\n')).toEqual(['Что случилось:', 'Как повторить:', 'Ожидалось:'])
  })

  it('fills a new note created with the label', () => {
    expect(applyBugRules(null, makeNote({ labels: ['баг'] })).body).toBe(BUG_TEMPLATE)
  })

  it('keeps text that is already there', () => {
    const before = makeNote({ body: 'Падает при старте' })
    expect(applyBugRules(before, { ...before, labels: ['Баг'] }).body).toBe('Падает при старте')
  })

  it('does not come back when the user clears the text of a bug', () => {
    const before = makeNote({ labels: ['Баг'], body: BUG_TEMPLATE })
    expect(applyBugRules(before, { ...before, body: '' }).body).toBe('')
  })
})

describe('"Фикс" label', () => {
  it('is added when a solution is saved', () => {
    const before = makeNote({ labels: ['Баг'] })
    const after = applyBugRules(before, { ...before, solution: 'Отписка от событий' })
    expect(after.labels).toEqual(['Баг', 'Фикс'])
  })

  it('is not added twice or for an empty solution', () => {
    const fixed = makeNote({ labels: ['Баг', 'фикс'], solution: 'a' })
    expect(applyBugRules(fixed, { ...fixed, solution: 'ab' }).labels).toEqual(['Баг', 'фикс'])
    const bug = makeNote({ labels: ['Баг'] })
    expect(applyBugRules(bug, { ...bug, solution: '  ' }).labels).toEqual(['Баг'])
  })

  it('stays when the user removes it and edits something else', () => {
    const before = makeNote({ labels: ['Баг'], solution: 'Решение' })
    expect(applyBugRules(before, { ...before, title: 'Новый' }).labels).toEqual(['Баг'])
  })
})

describe('"how I fixed it" field', () => {
  it('shows for a finished bug or a note that already has a solution', () => {
    expect(showsSolution(makeNote({ labels: ['Баг'], status: 'done' }))).toBe(true)
    expect(showsSolution(makeNote({ labels: ['Баг'], status: 'wip' }))).toBe(false)
    expect(showsSolution(makeNote({ status: 'done' }))).toBe(false)
    expect(showsSolution(makeNote({ solution: 'Есть решение' }))).toBe(true)
  })
})
