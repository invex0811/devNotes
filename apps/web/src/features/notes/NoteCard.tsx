import type { Label, Note } from '@devnotes/core'
import { Pin } from 'lucide-react'
import { strings } from '../../i18n'
import { useActions } from '../../store/hooks'
import { LabelBadge } from '../../ui/LabelBadge'
import { StatusPill } from '../../ui/StatusPill'
import { NOTE_SURFACE } from '../../ui/theme'
import { BodyPreview } from './BodyPreview'
import { formatNoteDate } from './formatDate'
import { labelColor } from './labelColor'

interface NoteCardProps {
  note: Note
  projectName: string
  labels: readonly Label[]
  now: Date
}

export function NoteCard({ note, projectName, labels, now }: NoteCardProps) {
  const actions = useActions()
  const open = () => {
    actions.openNote(note.id)
  }

  return (
    <article
      onClick={open}
      className={`group flex cursor-pointer flex-col rounded-card border border-line p-4 hover:border-fg-muted/50 ${NOTE_SURFACE[note.color]}`}
    >
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-[15px] leading-snug font-semibold break-words text-fg">
          {note.title === '' ? (
            <span className="text-fg-muted">{strings.note.untitled}</span>
          ) : (
            note.title
          )}
        </h2>
        {note.pinned && (
          <Pin
            role="img"
            aria-label={strings.note.pinned}
            size={16}
            fill="currentColor"
            className="mt-0.5 shrink-0 rotate-45 text-accent"
          />
        )}
      </div>

      <BodyPreview note={note} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill
          status={note.status}
          onCycle={(event) => {
            event.stopPropagation()
            actions.cycleStatus(note.id)
          }}
        />
        {note.labels.map((name) => (
          <LabelBadge key={name} name={name} color={labelColor(labels, name)} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 font-mono text-xs text-fg-muted">
        <span className="min-w-0 truncate">
          {projectName} · {formatNoteDate(note.updatedAt, now)}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            open()
          }}
          className="shrink-0 rounded-sm font-sans text-[13px] font-semibold text-accent underline underline-offset-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        >
          {strings.note.open}
        </button>
      </div>
    </article>
  )
}
