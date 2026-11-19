import type { LabelColor, NoteColor, NoteStatus } from '@devnotes/core'

// Tailwind only generates classes it can find as whole strings in the source,
// so every color variant is listed here literally instead of being assembled.

export const TAG_TEXT: Record<LabelColor, string> = {
  violet: 'text-tag-violet',
  red: 'text-tag-red',
  blue: 'text-tag-blue',
  amber: 'text-tag-amber',
  green: 'text-tag-green',
  gray: 'text-tag-gray',
  pink: 'text-tag-pink',
  teal: 'text-tag-teal',
}

/** Badge background: the badge color at 14% opacity. */
export const TAG_TINT: Record<LabelColor, string> = {
  violet: 'bg-tag-violet/14',
  red: 'bg-tag-red/14',
  blue: 'bg-tag-blue/14',
  amber: 'bg-tag-amber/14',
  green: 'bg-tag-green/14',
  gray: 'bg-tag-gray/14',
  pink: 'bg-tag-pink/14',
  teal: 'bg-tag-teal/14',
}

export const TAG_SOLID: Record<LabelColor, string> = {
  violet: 'bg-tag-violet',
  red: 'bg-tag-red',
  blue: 'bg-tag-blue',
  amber: 'bg-tag-amber',
  green: 'bg-tag-green',
  gray: 'bg-tag-gray',
  pink: 'bg-tag-pink',
  teal: 'bg-tag-teal',
}

export const STATUS_TEXT: Record<NoteStatus, string> = {
  new: 'text-status-new',
  wip: 'text-status-wip',
  done: 'text-status-done',
}

export const STATUS_BORDER: Record<NoteStatus, string> = {
  new: 'border-status-new',
  wip: 'border-status-wip',
  done: 'border-status-done',
}

export const STATUS_TINT: Record<NoteStatus, string> = {
  new: 'bg-status-new/14',
  wip: 'bg-status-wip/14',
  done: 'bg-status-done/14',
}

export const STATUS_SOLID: Record<NoteStatus, string> = {
  new: 'bg-status-new',
  wip: 'bg-status-wip',
  done: 'bg-status-done',
}

export const NOTE_SURFACE: Record<NoteColor, string> = {
  default: 'bg-card',
  red: 'bg-note-red',
  violet: 'bg-note-violet',
  green: 'bg-note-green',
  yellow: 'bg-note-yellow',
}
