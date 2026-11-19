import { describe, expect, it } from 'vitest'
import { NOTE_STATUSES, SCHEMA_VERSION } from './index'

describe('core constants', () => {
  it('uses schema version 1', () => {
    expect(SCHEMA_VERSION).toBe(1)
  })

  it('lists statuses in workflow order', () => {
    expect(NOTE_STATUSES).toEqual(['new', 'wip', 'done'])
  })
})
