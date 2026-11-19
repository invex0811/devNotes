import { isSameLabel } from '@devnotes/core'
import { strings } from '../../i18n'
import { useActions, useApp, useLabels } from '../../store/hooks'
import { TAG_TEXT } from '../../ui/theme'

/**
 * On a phone the sidebar is hidden, so the label filter sits as a row of chips
 * under the quick input: "Все" and every label.
 */
export function LabelFilterChips() {
  const labels = useLabels()
  const filter = useApp((state) => state.labelFilter)
  const actions = useActions()

  const chip = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[15px] font-semibold ${active ? 'border-fg bg-fg text-page' : 'border-line bg-panel'}`

  return (
    <div
      role="group"
      aria-label={strings.nav.labels}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden"
    >
      <button
        type="button"
        aria-pressed={filter === null}
        onClick={() => {
          if (filter !== null) actions.toggleLabelFilter(filter)
        }}
        className={`${chip(filter === null)} ${filter === null ? '' : 'text-fg'}`}
      >
        {strings.labelFilter.all}
      </button>
      {labels.map((label) => {
        const active = filter !== null && isSameLabel(filter, label.name)
        return (
          <button
            key={label.name}
            type="button"
            aria-pressed={active}
            onClick={() => {
              actions.toggleLabelFilter(label.name)
            }}
            className={`${chip(active)} ${active ? '' : TAG_TEXT[label.color]}`}
          >
            {label.name}
          </button>
        )
      })}
    </div>
  )
}
