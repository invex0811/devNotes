import { Archive, Copy, Trash2, X } from 'lucide-react'
import { strings } from '../../i18n'
import { useActions, useApp } from '../../store/hooks'

const barButton =
  'inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-[15px] font-semibold text-fg hover:bg-panel'

/** "Выбрано N" at the bottom of the screen while notes are selected. */
export function SelectionBar({ onCopyForAi }: { onCopyForAi: () => void }) {
  const count = useApp((state) => state.selectedIds.length)
  const actions = useActions()
  if (count === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 md:bottom-5 flex justify-center px-4">
      <section
        aria-label={`${strings.selection.selected}: ${String(count)}`}
        className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-card border border-line bg-card py-1.5 pr-1.5 pl-2 shadow-lg"
      >
        <button
          type="button"
          aria-label={strings.selection.clear}
          title={strings.selection.clear}
          onClick={actions.clearSelection}
          className="inline-flex size-11 items-center justify-center rounded-control text-fg-muted hover:bg-panel hover:text-fg"
        >
          <X aria-hidden="true" size={18} />
        </button>
        <p className="mr-2 font-mono text-sm text-fg">
          {strings.selection.selected} {count}
        </p>
        <button type="button" onClick={onCopyForAi} className={barButton}>
          <Copy aria-hidden="true" size={16} />
          {strings.aiCopy.button}
        </button>
        <button type="button" onClick={actions.archiveSelected} className={barButton}>
          <Archive aria-hidden="true" size={16} />
          {strings.selection.archive}
        </button>
        <button
          type="button"
          onClick={actions.deleteSelected}
          className={`${barButton} text-tag-red`}
        >
          <Trash2 aria-hidden="true" size={16} />
          {strings.selection.delete}
        </button>
      </section>
    </div>
  )
}
