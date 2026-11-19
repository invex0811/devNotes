import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { SessionState, SessionStore } from '../data/google/session'

/** The Google session; absent in the demo mode. */
export const SessionContext = createContext<SessionStore | null>(null)

export function useSessionStore(): SessionStore | null {
  return useContext(SessionContext)
}

export function useSession<T>(selector: (state: SessionState) => T): T {
  const store = useContext(SessionContext)
  if (!store) throw new Error('useSession must be used inside SessionContext')
  return useStore(store, selector)
}
