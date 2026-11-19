import { z } from 'zod'

export const LABEL_NAME_MAX_LENGTH = 40

/** The eight ready-made colors a user label can have. */
export const LABEL_COLORS = [
  'violet',
  'red',
  'blue',
  'amber',
  'green',
  'gray',
  'pink',
  'teal',
] as const

export const labelColorSchema = z.enum(LABEL_COLORS)
export type LabelColor = z.infer<typeof labelColorSchema>

/** A label as stored in the `labels` sheet. Built-in labels are never stored. */
export const customLabelSchema = z.object({
  name: z.string().trim().min(1).max(LABEL_NAME_MAX_LENGTH),
  color: labelColorSchema,
  createdAt: z.iso.datetime(),
})
export type CustomLabel = z.infer<typeof customLabelSchema>

export interface Label {
  name: string
  color: LabelColor
  builtin: boolean
}

interface BuiltinLabel extends Label {
  builtin: true
  /** English prefixes that also work in quick input, e.g. `bug:`. */
  aliases: readonly string[]
}

export const BUILTIN_LABELS: readonly BuiltinLabel[] = [
  { name: 'Идея', color: 'violet', builtin: true, aliases: ['idea'] },
  { name: 'Баг', color: 'red', builtin: true, aliases: ['bug'] },
  { name: 'Фикс', color: 'blue', builtin: true, aliases: ['fix'] },
]

/** Comparison key: labels are matched by name without regard to case. */
export function labelKey(name: string): string {
  return name.trim().toLocaleLowerCase('ru')
}

export function isSameLabel(a: string, b: string): boolean {
  return labelKey(a) === labelKey(b)
}

/** Built-in labels first, then the user's own in creation order. */
export function allLabels(custom: readonly CustomLabel[]): Label[] {
  const own = custom
    .filter((label) => !BUILTIN_LABELS.some((builtin) => isSameLabel(builtin.name, label.name)))
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((label): Label => ({ name: label.name, color: label.color, builtin: false }))
  return [
    ...BUILTIN_LABELS.map(({ name, color }): Label => ({ name, color, builtin: true })),
    ...own,
  ]
}

export function findLabel(labels: readonly Label[], name: string): Label | undefined {
  return labels.find((label) => isSameLabel(label.name, name))
}

export type LabelNameError = 'empty' | 'too_long' | 'duplicate'

/**
 * Checks a name for a new or renamed label. `currentName` is the label being renamed,
 * so that keeping its own name (or changing only the letter case) is allowed.
 */
export function validateLabelName(
  name: string,
  labels: readonly Label[],
  currentName?: string,
): LabelNameError | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'empty'
  if (trimmed.length > LABEL_NAME_MAX_LENGTH) return 'too_long'
  const key = labelKey(trimmed)
  const isOwnName = currentName !== undefined && isSameLabel(currentName, trimmed)
  if (isOwnName) return null
  const takenByLabel = labels.some((label) => labelKey(label.name) === key)
  const takenByAlias = BUILTIN_LABELS.some((builtin) => builtin.aliases.includes(key))
  return takenByLabel || takenByAlias ? 'duplicate' : null
}

export function hasLabel(noteLabels: readonly string[], name: string): boolean {
  return noteLabels.some((label) => isSameLabel(label, name))
}

export function toggleLabel(noteLabels: readonly string[], name: string): string[] {
  return hasLabel(noteLabels, name)
    ? noteLabels.filter((label) => !isSameLabel(label, name))
    : [...noteLabels, name]
}

export function renameLabelInList(
  noteLabels: readonly string[],
  from: string,
  to: string,
): string[] {
  return noteLabels.map((label) => (isSameLabel(label, from) ? to : label))
}

export function removeLabelFromList(noteLabels: readonly string[], name: string): string[] {
  return noteLabels.filter((label) => !isSameLabel(label, name))
}
