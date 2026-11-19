import { BUILTIN_LABELS, labelKey, type Label } from './labels'
import { clampTitle } from './note'

export interface QuickInput {
  /** Note title with the label prefix removed. Empty when there is nothing to save. */
  title: string
  /** Name of the label recognised from the prefix, if any. */
  label: string | null
}

/**
 * Smart quick input: text that starts with the name of an existing label and a colon
 * ("баг: …") gets that label, and the prefix is removed from the title. Built-in labels
 * also answer to `bug:`, `idea:` and `fix:`. Letter case does not matter.
 */
export function parseQuickInput(text: string, labels: readonly Label[]): QuickInput {
  const trimmed = text.trim()
  const colon = trimmed.indexOf(':')
  if (colon > 0) {
    const prefix = labelKey(trimmed.slice(0, colon))
    const label =
      labels.find((candidate) => labelKey(candidate.name) === prefix) ??
      BUILTIN_LABELS.find((builtin) => builtin.aliases.includes(prefix))
    if (label) {
      return { title: clampTitle(trimmed.slice(colon + 1).trim()), label: label.name }
    }
  }
  return { title: clampTitle(trimmed), label: null }
}
