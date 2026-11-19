import type { Scope } from '@devnotes/core'
import { useMemo, useSyncExternalStore } from 'react'

// Hash routing: GitHub Pages cannot rewrite paths, so the scope lives after "#".

export function parseHash(hash: string): Scope {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'inbox') return { kind: 'inbox' }
  if (path === 'archive') return { kind: 'archive' }
  if (path === 'review') return { kind: 'review' }
  const project = /^project\/(.+)$/.exec(path)
  if (project?.[1]) {
    try {
      return { kind: 'project', projectId: decodeURIComponent(project[1]) }
    } catch {
      return { kind: 'all' }
    }
  }
  return { kind: 'all' }
}

export function scopeHref(scope: Scope): string {
  switch (scope.kind) {
    case 'all':
      return '#/'
    case 'inbox':
      return '#/inbox'
    case 'archive':
      return '#/archive'
    case 'review':
      return '#/review'
    case 'project':
      return `#/project/${encodeURIComponent(scope.projectId)}`
  }
}

/** Stable string identity of a scope, for React keys and comparisons. */
export function scopeKey(scope: Scope): string {
  return scopeHref(scope)
}

export function navigate(scope: Scope): void {
  window.location.hash = scopeHref(scope).slice(1)
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
  }
}

export function useScope(): Scope {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parseHash(hash), [hash])
}

/** Demo mode is switched on by the address `?demo=1`. */
export function isDemoMode(search: string): boolean {
  return new URLSearchParams(search).get('demo') === '1'
}
