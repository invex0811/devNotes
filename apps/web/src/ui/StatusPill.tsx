import type { NoteStatus } from '@devnotes/core'
import type { MouseEvent } from 'react'
import { strings } from '../i18n'
import { STATUS_BORDER, STATUS_SOLID, STATUS_TEXT, STATUS_TINT } from './theme'

interface StatusPillProps {
  status: NoteStatus
  /** Moves the note to the next status. */
  onCycle: (event: MouseEvent<HTMLButtonElement>) => void
}

/** A status is an oval button with a dot and a border; clicking it cycles the status. */
export function StatusPill({ status, onCycle }: StatusPillProps) {
  const name = strings.status.names[status]
  return (
    <button
      type="button"
      onClick={onCycle}
      title={strings.status.cycleHint}
      aria-label={`${strings.status.label}: ${name}`}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-xs ${STATUS_BORDER[status]} ${STATUS_TEXT[status]} ${STATUS_TINT[status]} hover:brightness-125`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS_SOLID[status]}`} />
      {name}
    </button>
  )
}
