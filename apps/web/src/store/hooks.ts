import {
  activeProjects,
  allLabels,
  listedNotes,
  type Label,
  type Note,
  type Project,
} from '@devnotes/core'
import { useContext, useMemo } from 'react'
import { useStore } from 'zustand'
import type { AppActions, AppState } from './appStore'
import { AppStoreContext } from './storeContext'

export function useApp<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useApp must be used inside AppStoreProvider')
  return useStore(store, selector)
}

export function useActions(): AppActions {
  return useApp((state) => state.actions)
}

/** Built-in labels plus the user's own. */
export function useLabels(): Label[] {
  const custom = useApp((state) => state.customLabels)
  return useMemo(() => allLabels(custom), [custom])
}

/** Projects shown in the app, in the user's order. */
export function useProjects(): Project[] {
  const projects = useApp((state) => state.projects)
  return useMemo(() => activeProjects(projects), [projects])
}

/** Notes the app shows anywhere: not deleted, not on review, not of a removed project. */
export function useListedNotes(): Note[] {
  const notes = useApp((state) => state.notes)
  const projects = useApp((state) => state.projects)
  return useMemo(() => listedNotes(notes, projects), [notes, projects])
}
