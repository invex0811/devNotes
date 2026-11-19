import {
  activeProjects,
  allLabels,
  listedNotes,
  reviewNotes,
  selectNotes,
  type Label,
  type Note,
  type Project,
  type Scope,
} from '@devnotes/core'
import { useCallback, useContext, useMemo } from 'react'
import { useStore } from 'zustand'
import { strings } from '../i18n'
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

/** Notes of the scope after the sidebar filters and search, in display order. */
export function useVisibleNotes(scope: Scope): Note[] {
  const listed = useListedNotes()
  const status = useApp((state) => state.statusFilter)
  const label = useApp((state) => state.labelFilter)
  const query = useApp((state) => state.query)
  return useMemo(
    () => selectNotes(listed, scope, { status, label, query }),
    [listed, scope, status, label, query],
  )
}

/** Whether a filter or a search narrows the notes of the scope. */
export function useIsFiltered(): boolean {
  return useApp(
    (state) =>
      state.statusFilter !== null || state.labelFilter !== null || state.query.trim() !== '',
  )
}

/** The name of a note's project, "Без проекта" for none. */
export function useProjectName(): (projectId: string | null) => string {
  const projects = useProjects()
  return useCallback(
    (projectId) =>
      projects.find((project) => project.id === projectId)?.name ?? strings.project.none,
    [projects],
  )
}

/** AI cards waiting for review, newest first. */
export function useReviewNotes(): Note[] {
  const notes = useApp((state) => state.notes)
  const projects = useApp((state) => state.projects)
  return useMemo(() => reviewNotes(notes, projects), [notes, projects])
}
