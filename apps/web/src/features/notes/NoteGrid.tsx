import { selectNotes, type Scope } from '@devnotes/core'
import { useMemo } from 'react'
import { strings } from '../../i18n'
import { useApp, useLabels, useListedNotes, useProjects } from '../../store/hooks'
import { NoteCard } from './NoteCard'

export function NoteGrid({ scope }: { scope: Scope }) {
  const listed = useListedNotes()
  const projects = useProjects()
  const labels = useLabels()
  const status = useApp((state) => state.statusFilter)
  const label = useApp((state) => state.labelFilter)
  const query = useApp((state) => state.query)

  const notes = useMemo(
    () => selectNotes(listed, scope, { status, label, query }),
    [listed, scope, status, label, query],
  )
  const now = new Date()

  if (notes.length === 0) {
    const filtered = status !== null || label !== null || query.trim() !== ''
    const title = filtered
      ? strings.grid.nothingFound
      : scope.kind === 'archive'
        ? strings.grid.emptyArchive
        : strings.grid.empty
    const hint = filtered
      ? strings.grid.nothingFoundHint
      : scope.kind === 'archive'
        ? null
        : strings.grid.emptyHint
    return (
      <div className="rounded-card border border-dashed border-line px-6 py-12 text-center">
        <p className="text-base font-semibold text-fg">{title}</p>
        {hint && <p className="mt-2 text-sm text-fg-muted">{hint}</p>}
      </div>
    )
  }

  return (
    <section
      aria-label={strings.grid.label}
      className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16.5rem),1fr))] items-start gap-3.5"
    >
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          labels={labels}
          now={now}
          projectName={
            projects.find((project) => project.id === note.projectId)?.name ?? strings.project.none
          }
        />
      ))}
    </section>
  )
}
