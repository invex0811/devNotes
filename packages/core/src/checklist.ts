/** One line of a note body. Checklist items start with `[ ]` or `[x]`. */
export type BodyLine =
  | { kind: 'text'; line: number; text: string }
  | { kind: 'item'; line: number; text: string; checked: boolean }

const ITEM_PATTERN = /^\[([ xX])\] ?(.*)$/

/** Splits a plain-text body into lines and recognises checklist items. */
export function parseBody(body: string): BodyLine[] {
  if (body === '') return []
  return body.split('\n').map((raw, line): BodyLine => {
    const match = ITEM_PATTERN.exec(raw)
    if (!match) return { kind: 'text', line, text: raw }
    return { kind: 'item', line, text: match[2] ?? '', checked: match[1] !== ' ' }
  })
}

export function hasChecklist(body: string): boolean {
  return parseBody(body).some((line) => line.kind === 'item')
}

/** Flips `[ ]` ↔ `[x]` on the given line. Lines that are not checklist items stay as is. */
export function toggleChecklistLine(body: string, line: number): string {
  const lines = body.split('\n')
  const raw = lines[line]
  if (raw === undefined) return body
  const match = ITEM_PATTERN.exec(raw)
  if (!match) return body
  const mark = match[1] === ' ' ? 'x' : ' '
  lines[line] = `[${mark}]${raw.slice(3)}`
  return lines.join('\n')
}
