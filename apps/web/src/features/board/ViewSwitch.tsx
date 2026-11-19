import { Columns3, LayoutGrid } from 'lucide-react'
import type { NotesView } from '../../store/appStore'
import { strings } from '../../i18n'
import { useActions, useApp } from '../../store/hooks'

const VIEWS: { view: NotesView; icon: typeof LayoutGrid }[] = [
  { view: 'grid', icon: LayoutGrid },
  { view: 'board', icon: Columns3 },
]

/** "Сетка / Доска" switch in the header. */
export function ViewSwitch() {
  const view = useApp((state) => state.view)
  const actions = useActions()
  return (
    <div
      role="group"
      aria-label={strings.view.label}
      className="inline-flex shrink-0 overflow-hidden rounded-control border border-line bg-panel"
    >
      {VIEWS.map(({ view: option, icon: Icon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => {
            actions.setView(option)
          }}
          className={`inline-flex min-h-11 items-center gap-2 px-4 text-[15px] font-semibold ${view === option ? 'bg-card text-fg' : 'text-fg-muted hover:text-fg'}`}
        >
          <Icon aria-hidden="true" size={16} />
          {strings.view[option]}
        </button>
      ))}
    </div>
  )
}
