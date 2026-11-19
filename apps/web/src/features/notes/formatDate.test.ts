import { describe, expect, it } from 'vitest'
import { formatNoteDate } from './formatDate'

const now = new Date(2026, 10, 19, 11, 0)
const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month, day, hour).toISOString()

describe('formatNoteDate', () => {
  it('says "сегодня" and "вчера" by calendar day, not by 24 hours', () => {
    expect(formatNoteDate(at(2026, 10, 19, 0), now)).toBe('сегодня')
    expect(formatNoteDate(at(2026, 10, 18, 23), now)).toBe('вчера')
  })

  it('shows day and short month for older dates', () => {
    expect(formatNoteDate(at(2026, 10, 12), now)).toBe('12 ноя')
    expect(formatNoteDate(at(2026, 4, 3), now)).toBe('3 мая')
  })

  it('adds the year when it differs from the current one', () => {
    expect(formatNoteDate(at(2025, 10, 3), now)).toBe('3 ноя 2025')
  })
})
