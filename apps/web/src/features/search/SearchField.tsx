import { Search, X } from 'lucide-react'
import { strings } from '../../i18n'
import { useActions, useApp } from '../../store/hooks'

/** Searches title, text and solution inside the current scope as the user types. */
export function SearchField() {
  const query = useApp((state) => state.query)
  const actions = useActions()

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted"
      />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          actions.setQuery(event.target.value)
        }}
        aria-label={strings.search.label}
        placeholder={strings.search.placeholder}
        className="min-h-11 w-full rounded-control border border-line bg-panel pr-10 pl-9 text-[15px] text-fg placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {query !== '' && (
        <button
          type="button"
          aria-label={strings.search.clear}
          title={strings.search.clear}
          onClick={() => {
            actions.setQuery('')
          }}
          className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-control text-fg-muted hover:text-fg"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
