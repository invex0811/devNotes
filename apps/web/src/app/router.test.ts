import { describe, expect, it } from 'vitest'
import { isDemoMode, parseHash, scopeHref } from './router'

describe('hash routing', () => {
  it('reads the scope from the address', () => {
    expect(parseHash('')).toEqual({ kind: 'all' })
    expect(parseHash('#/')).toEqual({ kind: 'all' })
    expect(parseHash('#/inbox')).toEqual({ kind: 'inbox' })
    expect(parseHash('#/archive')).toEqual({ kind: 'archive' })
    expect(parseHash('#/project/abc-1')).toEqual({ kind: 'project', projectId: 'abc-1' })
    expect(parseHash('#/something-else')).toEqual({ kind: 'all' })
    expect(parseHash('#/project/%E0%A4%A')).toEqual({ kind: 'all' })
  })

  it('builds addresses that read back to the same scope', () => {
    const scopes = [
      { kind: 'all' },
      { kind: 'inbox' },
      { kind: 'archive' },
      { kind: 'project', projectId: 'id with / and пробел' },
    ] as const
    for (const scope of scopes) expect(parseHash(scopeHref(scope))).toEqual(scope)
  })

  it('turns demo mode on only for ?demo=1', () => {
    expect(isDemoMode('?demo=1')).toBe(true)
    expect(isDemoMode('?demo=0')).toBe(false)
    expect(isDemoMode('')).toBe(false)
  })
})
