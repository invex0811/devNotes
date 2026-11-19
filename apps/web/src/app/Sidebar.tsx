import {
  NOTE_STATUSES,
  countInScope,
  countLabel,
  countStatuses,
  isSameLabel,
  isSharedProject,
  type Label,
  type Project,
  type Scope,
} from '@devnotes/core'
import { Pencil, Plus, TriangleAlert, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { LabelDialog } from '../features/labels/LabelDialog'
import { ConnectProjectButton } from '../features/projects/ConnectProjectButton'
import { NewProjectForm } from '../features/projects/NewProjectForm'
import { ProjectDialog } from '../features/projects/ProjectDialog'
import { AccountPanel } from '../features/sync/AccountPanel'
import { strings } from '../i18n'
import {
  useActions,
  useApp,
  useLabels,
  useListedNotes,
  useProjects,
  useReviewNotes,
} from '../store/hooks'
import { useSessionStore } from '../store/sessionContext'
import { Logo } from '../ui/Logo'
import { sectionTitleClass } from '../ui/styles'
import { STATUS_SOLID, TAG_SOLID } from '../ui/theme'
import { navigate, scopeHref, scopeKey } from './router'

const rowClass =
  'flex min-h-11 w-full items-center gap-2.5 rounded-control px-3 text-left text-[15px] text-fg hover:bg-card'
const activeRowClass = 'bg-card font-semibold'
const countClass = 'ml-auto font-mono text-xs font-normal text-fg-muted'
const editButtonClass =
  'absolute top-1/2 right-9 flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-fg-muted opacity-0 group-hover:opacity-100 hover:text-fg focus-visible:opacity-100 pointer-coarse:opacity-100'

interface SidebarProps {
  scope: Scope
  /** Called when the user picks a section, so the mobile menu can close. */
  onNavigate: () => void
}

export function Sidebar({ scope, onNavigate }: SidebarProps) {
  const actions = useActions()
  const notes = useListedNotes()
  const projects = useProjects()
  const labels = useLabels()
  const reviewCount = useReviewNotes().length
  const statusFilter = useApp((state) => state.statusFilter)
  const labelFilter = useApp((state) => state.labelFilter)
  const session = useSessionStore()
  // Fixed when the session is created: the Picker keys are in the build or not.
  const canConnect = session?.getState().canConnect ?? false

  const [editedProject, setEditedProject] = useState<Project | null>(null)
  const [editedLabel, setEditedLabel] = useState<Label | null>(null)
  const [creatingLabel, setCreatingLabel] = useState(false)

  const statusCounts = countStatuses(notes, scope)

  const scopeLink = (target: Scope, name: string, extra?: ReactNode) => {
    const current = scopeKey(target) === scopeKey(scope)
    return (
      <a
        href={scopeHref(target)}
        aria-current={current ? 'page' : undefined}
        onClick={onNavigate}
        className={`${rowClass} ${current ? activeRowClass : ''}`}
      >
        <span className="min-w-0 truncate">{name}</span>
        {extra}
        <span className={countClass}>{countInScope(notes, target)}</span>
      </a>
    )
  }

  return (
    <nav aria-label={strings.nav.label} className="flex min-h-full flex-col px-3 py-5">
      <div className="px-3 pb-5">
        <Logo />
      </div>

      <ul className="space-y-0.5">
        <li>{scopeLink({ kind: 'all' }, strings.nav.all)}</li>
        <li>{scopeLink({ kind: 'inbox' }, strings.nav.inbox)}</li>
        <li>
          <a
            href={scopeHref({ kind: 'review' })}
            aria-current={scope.kind === 'review' ? 'page' : undefined}
            onClick={onNavigate}
            className={`${rowClass} ${scope.kind === 'review' ? activeRowClass : ''}`}
          >
            <span className="min-w-0 truncate">{strings.nav.review}</span>
            <span
              className={
                reviewCount > 0
                  ? 'ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-xs font-semibold text-on-accent'
                  : countClass
              }
            >
              {reviewCount}
            </span>
          </a>
        </li>
        <li>{scopeLink({ kind: 'archive' }, strings.nav.archive)}</li>
      </ul>

      <h2 className={`${sectionTitleClass} mt-6 mb-1.5`}>{strings.nav.projects}</h2>
      <ul className="space-y-0.5">
        {projects.map((project) => (
          <li key={project.id} className="group relative">
            {scopeLink(
              { kind: 'project', projectId: project.id },
              project.name,
              <ProjectMarks project={project} />,
            )}
            <button
              type="button"
              aria-label={`${strings.project.settings}: ${project.name}`}
              title={strings.project.settings}
              onClick={() => {
                setEditedProject(project)
              }}
              className={editButtonClass}
            >
              <Pencil size={14} />
            </button>
          </li>
        ))}
        <li>
          <NewProjectForm
            onCreated={(project) => {
              navigate({ kind: 'project', projectId: project.id })
              onNavigate()
            }}
          />
        </li>
        {canConnect && (
          <li>
            <ConnectProjectButton
              onConnected={(projectId) => {
                navigate({ kind: 'project', projectId })
                onNavigate()
              }}
            />
          </li>
        )}
      </ul>

      <h2 className={`${sectionTitleClass} mt-6 mb-1.5`}>{strings.nav.status}</h2>
      <ul className="space-y-0.5">
        {NOTE_STATUSES.map((status) => (
          <li key={status}>
            <button
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => {
                actions.toggleStatusFilter(status)
              }}
              className={`${rowClass} ${statusFilter === status ? activeRowClass : ''}`}
            >
              <span aria-hidden="true" className={`size-2 rounded-full ${STATUS_SOLID[status]}`} />
              {strings.status.names[status]}
              <span className={countClass}>{statusCounts[status]}</span>
            </button>
          </li>
        ))}
      </ul>

      <h2 className={`${sectionTitleClass} mt-6 mb-1.5`}>{strings.nav.labels}</h2>
      <ul className="space-y-0.5">
        {labels.map((label) => {
          const active = labelFilter !== null && isSameLabel(labelFilter, label.name)
          return (
            <li key={label.name} className="group relative">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  actions.toggleLabelFilter(label.name)
                }}
                className={`${rowClass} ${active ? activeRowClass : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-[3px] ${TAG_SOLID[label.color]}`}
                />
                <span className="min-w-0 truncate">{label.name}</span>
                <span className={countClass}>{countLabel(notes, scope, label.name)}</span>
              </button>
              {!label.builtin && (
                <button
                  type="button"
                  aria-label={`${strings.label.edit}: ${label.name}`}
                  title={strings.label.edit}
                  onClick={() => {
                    setEditedLabel(label)
                  }}
                  className={editButtonClass}
                >
                  <Pencil size={14} />
                </button>
              )}
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => {
              setCreatingLabel(true)
            }}
            className={`${rowClass} text-fg-muted hover:text-fg`}
          >
            <Plus aria-hidden="true" size={18} />
            {strings.label.new}
          </button>
        </li>
      </ul>

      <div className="mt-auto pt-6">
        {session ? (
          <AccountPanel />
        ) : (
          <div className="border-t border-divider px-3 pt-4">
            <p className="text-sm font-semibold text-fg">{strings.demo.title}</p>
            <p className="mt-0.5 font-mono text-xs text-fg-muted">{strings.demo.hint}</p>
          </div>
        )}
      </div>

      {editedProject && (
        <ProjectDialog
          project={editedProject}
          onClose={() => {
            setEditedProject(null)
          }}
          onRemoved={(project) => {
            setEditedProject(null)
            if (scope.kind === 'project' && scope.projectId === project.id) {
              navigate({ kind: 'all' })
            }
          }}
        />
      )}
      {editedLabel && (
        <LabelDialog
          label={editedLabel}
          onClose={() => {
            setEditedLabel(null)
          }}
        />
      )}
      {creatingLabel && (
        <LabelDialog
          onClose={() => {
            setCreatingLabel(false)
          }}
        />
      )}
    </nav>
  )
}

/** Icons after a project name: shared, or its spreadsheet is unavailable. */
function ProjectMarks({ project }: { project: Project }) {
  if (project.unavailable) {
    return (
      <span title={strings.project.unavailable} className="shrink-0 text-status-wip">
        <TriangleAlert size={14} aria-hidden="true" />
        <span className="sr-only">{strings.project.unavailable}</span>
      </span>
    )
  }
  if (!isSharedProject(project)) return null
  return (
    <span title={strings.project.shared} className="shrink-0 text-fg-muted">
      <Users size={14} aria-hidden="true" />
      <span className="sr-only">{strings.project.shared}</span>
    </span>
  )
}
