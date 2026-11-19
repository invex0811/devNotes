import type { Label, Note } from '@devnotes/core'
import { Pin } from 'lucide-react'
import { useRef, type PointerEvent } from 'react'
import { strings } from '../../i18n'
import { useActions, useApp } from '../../store/hooks'
import { LabelBadge } from '../../ui/LabelBadge'
import { StatusPill } from '../../ui/StatusPill'
import { NOTE_SURFACE } from '../../ui/theme'
import { BodyPreview } from './BodyPreview'
import { formatNoteDate } from './formatDate'
import { labelColor } from './labelColor'

/** A press this long on a touch screen starts selecting notes. */
const LONG_PRESS_MS = 500
/** A finger that moves farther than this is scrolling, not pressing. */
const LONG_PRESS_SLOP_PX = 10

interface NoteCardProps {
  note: Note
  projectName: string
  labels: readonly Label[]
  now: Date
  /** The board shows a compact card: its column already tells the status. */
  variant?: 'grid' | 'board'
}

export function NoteCard({ note, projectName, labels, now, variant = 'grid' }: NoteCardProps) {
  const actions = useActions()
  const selected = useApp((state) => state.selectedIds.includes(note.id))
  const selecting = useApp((state) => state.selectedIds.length > 0)
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const pressed = useRef(false)
  const board = variant === 'board'

  const open = () => {
    actions.openNote(note.id)
  }

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }

  // Long press on a phone starts selecting (on the board the same gesture drags).
  const onPointerDown = (event: PointerEvent) => {
    if (board || event.pointerType !== 'touch') return
    pressed.current = false
    const timer = window.setTimeout(() => {
      pressed.current = true
      press.current = null
      actions.toggleSelected(note.id)
    }, LONG_PRESS_MS)
    press.current = { timer, x: event.clientX, y: event.clientY }
  }

  const onPointerMove = (event: PointerEvent) => {
    const start = press.current
    if (!start) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP_PX) {
      cancelPress()
    }
  }

  const onClick = () => {
    if (pressed.current) {
      // The click that ends a long press must not undo it.
      pressed.current = false
      return
    }
    if (selecting) actions.toggleSelected(note.id)
    else open()
  }

  const title =
    note.title === '' ? <span className="text-fg-muted">{strings.note.untitled}</span> : note.title
  const date = formatNoteDate(note.updatedAt, now)

  return (
    <article
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(event) => {
        if (pressed.current || press.current) event.preventDefault()
      }}
      className={`group relative flex cursor-pointer flex-col rounded-card border p-4 select-none hover:border-fg-muted/50 ${NOTE_SURFACE[note.color]} ${selected ? 'border-accent ring-1 ring-accent' : 'border-line'}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => {
          actions.toggleSelected(note.id)
        }}
        onClick={(event) => {
          event.stopPropagation()
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        aria-label={`${strings.selection.select}: ${note.title || strings.note.untitled}`}
        className={`absolute -top-2 -left-2 size-5 cursor-pointer accent-accent ${selecting ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden'}`}
      />
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-[15px] leading-snug font-semibold break-words text-fg">
          {title}
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

      {!board && <BodyPreview note={note} />}

      {note.solution.trim() !== '' && (
        <p className="mt-3 line-clamp-3 rounded-control bg-tag-blue/10 px-3 py-2 text-sm leading-relaxed text-fg-secondary">
          <span className="font-semibold text-tag-blue">{strings.solution.title}:</span>{' '}
          {note.solution.trim()}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!board && (
          <StatusPill
            status={note.status}
            onCycle={(event) => {
              event.stopPropagation()
              actions.cycleStatus(note.id)
            }}
          />
        )}
        {note.labels.map((name) => (
          <LabelBadge key={name} name={name} color={labelColor(labels, name)} />
        ))}
        {board && (
          // On the board "Открыть" takes the place of the date on hover, as in the mockup.
          <span className="relative ml-auto">
            <span className="font-mono text-xs text-fg-muted group-focus-within:opacity-0 group-hover:opacity-0">
              {date}
            </span>
            <OpenButton
              onOpen={open}
              className="absolute top-1/2 right-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            />
          </span>
        )}
      </div>

      {!board && (
        <div className="mt-3 flex items-center justify-between gap-3 font-mono text-xs text-fg-muted">
          <span className="min-w-0 truncate">
            {projectName} · {date}
          </span>
          <OpenButton
            onOpen={open}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          />
        </div>
      )}
    </article>
  )
}

function OpenButton({ onOpen, className }: { onOpen: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      className={`shrink-0 rounded-sm font-sans text-[13px] font-semibold text-accent underline underline-offset-2 ${className}`}
    >
      {strings.note.open}
    </button>
  )
}
