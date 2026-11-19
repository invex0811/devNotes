import type { Scope } from '@devnotes/core'
import { strings } from '../../i18n'
import { useIsFiltered } from '../../store/hooks'

/** What the grid shows instead of cards: nothing here yet, or nothing found. */
export function EmptyNotes({ scope }: { scope: Scope }) {
  const filtered = useIsFiltered()
  const archive = scope.kind === 'archive'
  const title = filtered
    ? strings.grid.nothingFound
    : archive
      ? strings.grid.emptyArchive
      : strings.grid.empty
  const hint = filtered ? strings.grid.nothingFoundHint : archive ? null : strings.grid.emptyHint
  return (
    <div className="rounded-card border border-dashed border-line px-6 py-12 text-center">
      <p className="text-base font-semibold text-fg">{title}</p>
      {hint && <p className="mt-2 text-sm text-fg-muted">{hint}</p>}
    </div>
  )
}
