import type { LabelColor } from '@devnotes/core'
import { TAG_TEXT, TAG_TINT } from './theme'

/** A label is a rectangular badge without a border. */
export function LabelBadge({ name, color }: { name: string; color: LabelColor }) {
  return (
    <span
      className={`inline-flex h-7 max-w-full items-center rounded-md px-2 font-mono text-xs font-medium ${TAG_TEXT[color]} ${TAG_TINT[color]}`}
    >
      <span className="truncate">{name}</span>
    </span>
  )
}
