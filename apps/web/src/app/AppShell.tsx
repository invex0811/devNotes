import { isSharedProject, type Note, type Scope } from '@devnotes/core'
import { ClipboardPaste, Copy, Menu, Search, TriangleAlert, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CopyForAiDialog } from '../features/ai-copy/CopyForAiDialog'
import { PasteFromAiDialog } from '../features/ai-import/PasteFromAiDialog'
import { LabelFilterChips } from '../features/labels/LabelFilterChips'
import { Board } from '../features/board/Board'
import { ViewSwitch } from '../features/board/ViewSwitch'
import { DeleteToast } from '../features/notes/DeleteToast'
import { NoteDialog } from '../features/notes/NoteDialog'
import { NoteGrid } from '../features/notes/NoteGrid'
import { ShareDialog } from '../features/projects/ShareDialog'
import { QuickAdd } from '../features/quick-add/QuickAdd'
import { ClaudeCodePage } from '../features/claude-code/ClaudeCodePage'
import { ReviewPage } from '../features/review/ReviewPage'
import { SearchField } from '../features/search/SearchField'
import { SelectionBar } from '../features/selection/SelectionBar'
import { SessionBanner } from '../features/sync/SessionBanner'
import { strings } from '../i18n'
import { useActions, useApp, useProjects, useVisibleNotes } from '../store/hooks'
import { useSessionStore } from '../store/sessionContext'
import { MenuButton, type MenuItem } from '../ui/MenuButton'
import { iconButtonClass, secondaryButtonClass } from '../ui/styles'
import { navigate, scopeKey, useIsClaudeCodePage, useScope } from './router'
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
    case 'review':
      return strings.nav.review
    case 'project':
      return projectName ?? strings.nav.all
  }
}

/** Page frame: sidebar, header with search, quick input and the notes. */
export function AppShell() {
  const scope = useScope()
  const claudeCodePage = useIsClaudeCodePage()
  const projects = useProjects()
  const [menuOpen, setMenuOpen] = useState(false)
  const session = useSessionStore()
  const [sharing, setSharing] = useState(false)
  /** The notes the "Copy for AI" dialog was opened with; null when it is closed. */
  const [aiNotes, setAiNotes] = useState<Note[] | null>(null)
  const [pasting, setPasting] = useState(false)
  /** On a phone the search field opens from an icon in the header. */
  const [searchOpen, setSearchOpen] = useState(false)
  const query = useApp((state) => state.query)
  const actions = useActions()
  const view = useApp((state) => state.view)
  const selectedIds = useApp((state) => state.selectedIds)
  const visible = useVisibleNotes(scope)

  // A selection belongs to the scope it was made in.
  const currentScope = scopeKey(scope)
  useEffect(() => {
    actions.clearSelection()
  }, [actions, currentScope])

  /** The selected notes in display order, or every note on screen when none is selected. */
  const notesForAi = (): Note[] =>
    selectedIds.length > 0 ? visible.filter((note) => selectedIds.includes(note.id)) : visible

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

  const headerActions: MenuItem[] = [
    {
      label: strings.aiImport.button,
      icon: <ClipboardPaste aria-hidden="true" size={18} />,
      onSelect: () => {
        setPasting(true)
      },
    },
    {
      label: strings.aiCopy.button,
      icon: <Copy aria-hidden="true" size={18} />,
      onSelect: () => {
        setAiNotes(notesForAi())
      },
    },
    ...(canShare
      ? [
          {
            label: strings.share.button,
            icon: <UserPlus aria-hidden="true" size={18} />,
            onSelect: () => {
              setSharing(true)
            },
          },
        ]
      : []),
  ]

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
          <div className="flex min-w-0 items-center gap-1 max-md:w-full">
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
            <div className="min-w-0 max-md:flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight text-fg">
                {claudeCodePage ? strings.claudeCode.title : scopeTitle(scope, project?.name)}
              </h1>
              {view === 'board' && scope.kind !== 'review' && (
                <p className="text-sm text-fg-muted max-md:hidden">{strings.board.hint}</p>
              )}
            </div>
            <button
              type="button"
              aria-label={strings.search.open}
              title={strings.search.open}
              aria-expanded={searchOpen || query !== ''}
              onClick={() => {
                setSearchOpen(!searchOpen)
              }}
              className={`${iconButtonClass} md:hidden`}
            >
              <Search size={20} />
            </button>
            <div className="-mr-2.5 md:hidden">
              <MenuButton label={strings.nav.moreActions} items={headerActions} />
            </div>
          </div>
          <div
            className={`w-full sm:max-w-sm ${searchOpen || query !== '' ? '' : 'max-md:hidden'}`}
          >
            <SearchField autoFocus={searchOpen} />
          </div>
          <div className="flex flex-wrap items-center gap-2 max-md:contents lg:ml-auto">
            {/* On a phone the switch is a bar at the bottom of the screen. */}
            <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:border-t max-md:border-divider max-md:bg-page max-md:px-4 max-md:pt-2 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <ViewSwitch className="max-md:w-full" />
            </div>
            <button
              type="button"
              onClick={() => {
                setPasting(true)
              }}
              className={`${secondaryButtonClass} gap-2 max-md:hidden`}
            >
              <ClipboardPaste aria-hidden="true" size={18} />
              {strings.aiImport.button}
            </button>
            <button
              type="button"
              onClick={() => {
                setAiNotes(notesForAi())
              }}
              className={`${secondaryButtonClass} gap-2 max-md:hidden`}
            >
              <Copy aria-hidden="true" size={18} />
              {strings.aiCopy.button}
            </button>
            {canShare && (
              <button
                type="button"
                onClick={() => {
                  setSharing(true)
                }}
                className={`${secondaryButtonClass} gap-2 max-md:hidden`}
              >
                <UserPlus aria-hidden="true" size={18} />
                {strings.share.button}
              </button>
            )}
          </div>
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
          {claudeCodePage && <ClaudeCodePage />}
          {!claudeCodePage && scope.kind === 'review' && <ReviewPage />}
          {!claudeCodePage && scope.kind !== 'archive' && scope.kind !== 'review' && (
            <QuickAdd
              key={scopeKey(scope)}
              defaultProjectId={scope.kind === 'project' ? scope.projectId : null}
            />
          )}
          {!claudeCodePage && scope.kind !== 'review' && <LabelFilterChips />}
          {!claudeCodePage &&
            scope.kind !== 'review' &&
            (view === 'board' ? <Board scope={scope} /> : <NoteGrid scope={scope} />)}
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
      {pasting && (
        <PasteFromAiDialog
          defaultProjectId={scope.kind === 'project' ? scope.projectId : null}
          onClose={() => {
            setPasting(false)
          }}
          onAdded={() => {
            setPasting(false)
            navigate({ kind: 'review' })
          }}
        />
      )}
      {aiNotes && (
        <CopyForAiDialog
          notes={aiNotes}
          onClose={() => {
            setAiNotes(null)
          }}
        />
      )}
      <SelectionBar
        onCopyForAi={() => {
          setAiNotes(notesForAi())
        }}
      />
      <NoteDialog />
      <DeleteToast />
    </div>
  )
}
