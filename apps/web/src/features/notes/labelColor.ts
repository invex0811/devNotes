import { findLabel, type Label, type LabelColor } from '@devnotes/core'

/** Color of a label on a note. A label unknown to the app is shown in gray. */
export function labelColor(labels: readonly Label[], name: string): LabelColor {
  return findLabel(labels, name)?.color ?? 'gray'
}
