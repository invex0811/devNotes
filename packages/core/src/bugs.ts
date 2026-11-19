import { hasLabel } from './labels'
import type { Note } from './note'

export const BUG_LABEL = 'Баг'
export const IDEA_LABEL = 'Идея'
export const FIX_LABEL = 'Фикс'

/**
 * Put into the empty text of a note that gets the "Баг" label. Ordinary lines of
 * the same text field, nothing special.
 */
export const BUG_TEMPLATE = 'Что случилось:\nКак повторить:\nОжидалось:'

/**
 * The rules for bugs, applied to every change of a note (`before` is null for a
 * new note):
 * - the "Баг" label added to a note with empty text fills in the bug template;
 * - a non-empty "how I fixed it" text adds the "Фикс" label.
 */
export function applyBugRules(before: Note | null, after: Note): Note {
  let next = after
  const becameBug =
    hasLabel(next.labels, BUG_LABEL) && !(before && hasLabel(before.labels, BUG_LABEL))
  if (becameBug && next.body.trim() === '') next = { ...next, body: BUG_TEMPLATE }

  const solutionChanged = next.solution !== (before?.solution ?? '')
  if (solutionChanged && next.solution.trim() !== '' && !hasLabel(next.labels, FIX_LABEL)) {
    next = { ...next, labels: [...next.labels, FIX_LABEL] }
  }
  return next
}

/** The "how I fixed it" field shows for a finished bug, or once it has text. */
export function showsSolution(note: Note): boolean {
  return (hasLabel(note.labels, BUG_LABEL) && note.status === 'done') || note.solution.trim() !== ''
}
