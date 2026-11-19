import type { Scope } from '@devnotes/core'
import { useLabels, useProjectName, useVisibleNotes } from '../../store/hooks'
import { strings } from '../../i18n'
import { EmptyNotes } from './EmptyNotes'
import { NoteCard } from './NoteCard'

export function NoteGrid({ scope }: { scope: Scope }) {
  const notes = useVisibleNotes(scope)
  const labels = useLabels()
  const projectName = useProjectName()
  const now = new Date()

  if (notes.length === 0) return <EmptyNotes scope={scope} />

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
          projectName={projectName(note.projectId)}
        />
      ))}
    </section>
  )
}
