import { isSharedProject, type Scope } from '@devnotes/core'
import { Menu, TriangleAlert, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DeleteToast } from '../features/notes/DeleteToast'
import { NoteDialog } from '../features/notes/NoteDialog'
import { NoteGrid } from '../features/notes/NoteGrid'
import { ShareDialog } from '../features/projects/ShareDialog'
import { QuickAdd } from '../features/quick-add/QuickAdd'
import { SearchField } from '../features/search/SearchField'
import { SessionBanner } from '../features/sync/SessionBanner'
import { strings } from '../i18n'
import { useProjects } from '../store/hooks'
import { useSessionStore } from '../store/sessionContext'
import { iconButtonClass, secondaryButtonClass } from '../ui/styles'
import { navigate, scopeKey, useScope } from './router'
import { Sidebar } from './Sidebar'

const SHARED_REFRESH_MS = 60_000

function scopeTitle(scope: Scope, projectName: string | undefined): string {
  switch (scope.kind) {
    case 'all':
      return strings.nav.all
    case 'inbox':
      return strings.nav.inbox
    case 'archive':
      return strings.nav.archive
    case 'project':
      return projectName ?? strings.nav.all
  }
}

/** Page frame: sidebar, header with search, quick input and the notes. */
export function AppShell() {
  const scope = useScope()
  const projects = useProjects()
  const [menuOpen, setMenuOpen] = useState(false)
  const session = useSessionStore()
  const [sharing, setSharing] = useState(false)

  const project =
    scope.kind === 'project' ? projects.find((p) => p.id === scope.projectId) : undefined
  const unknownProject = scope.kind === 'project' && !project

  // An address of a project that is not in the list (removed, or a stale link).
  useEffect(() => {
    if (unknownProject) navigate({ kind: 'all' })
  }, [unknownProject])

  // An open shared project is re-read every minute to show other people's edits.
  const sharedOpenId =
    session && project && isSharedProject(project) && !project.unavailable ? project.id : null
  useEffect(() => {
    if (!session || !sharedOpenId) return
    const timer = window.setInterval(() => {
      void session.getState().actions.refreshProject(sharedOpenId)
    }, SHARED_REFRESH_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [session, sharedOpenId])

  const canShare = session !== null && project?.role === 'owner' && !project.unavailable

  const closeMenu = () => {
    setMenuOpen(false)
  }

  return (
    <div className="flex min-h-dvh bg-page">
      {menuOpen && (
        <button
          type="button"
          aria-label={strings.nav.closeMenu}
          onClick={closeMenu}
          className="fixed inset-0 z-20 bg-backdrop/80 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 shrink-0 overflow-y-auto border-r border-divider bg-sidebar transition-transform md:visible md:sticky md:top-0 md:h-dvh md:w-60 md:translate-x-0 ${menuOpen ? 'translate-x-0' : 'invisible -translate-x-full'}`}
      >
        <Sidebar scope={scope} onNavigate={closeMenu} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-4 pb-4 md:px-8 md:pt-6">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              aria-label={strings.nav.openMenu}
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen(true)
              }}
              className={`${iconButtonClass} -ml-2.5 md:hidden`}
            >
              <Menu size={22} />
            </button>
            <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight text-fg">
              {scopeTitle(scope, project?.name)}
            </h1>
          </div>
          <SearchField />
          {canShare && (
            <button
              type="button"
              onClick={() => {
                setSharing(true)
              }}
              className={`${secondaryButtonClass} gap-2 md:ml-auto`}
            >
              <UserPlus aria-hidden="true" size={18} />
              {strings.share.button}
            </button>
          )}
        </header>

        <main className="space-y-5 px-4 pb-24 md:px-8">
          {session && <SessionBanner />}
          {project?.unavailable && (
            <section
              aria-label={strings.project.unavailable}
              className="flex gap-3 rounded-card border border-line bg-panel px-5 py-4"
            >
              <TriangleAlert
                aria-hidden="true"
                size={20}
                className="mt-0.5 shrink-0 text-status-wip"
              />
              <div>
                <h2 className="font-semibold text-fg">{strings.project.unavailable}</h2>
                <p className="mt-0.5 text-sm text-fg-secondary">
                  {strings.project.unavailableText}
                </p>
              </div>
            </section>
          )}
          {scope.kind !== 'archive' && (
            <QuickAdd
              key={scopeKey(scope)}
              defaultProjectId={scope.kind === 'project' ? scope.projectId : null}
            />
          )}
          <NoteGrid scope={scope} />
        </main>
      </div>

      {sharing && project && (
        <ShareDialog
          project={project}
          onClose={() => {
            setSharing(false)
          }}
        />
      )}
      <NoteDialog />
      <DeleteToast />
    </div>
  )
}
