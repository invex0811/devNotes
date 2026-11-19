import { parseBody, type Note } from '@devnotes/core'
import { useActions } from '../../store/hooks'

const MAX_LINES = 4

/** Up to four lines of the note text; checklist items can be ticked right on the card. */
export function BodyPreview({ note }: { note: Note }) {
  const actions = useActions()
  const lines = parseBody(note.body)
  if (lines.every((line) => line.text.trim() === '')) return null

  if (!lines.some((line) => line.kind === 'item')) {
    return (
      <p className="mt-2 line-clamp-4 text-sm leading-relaxed break-words whitespace-pre-line text-fg-secondary">
        {note.body.trim()}
      </p>
    )
  }

  const shown = lines.filter((line) => line.text.trim() !== '').slice(0, MAX_LINES)
  return (
    <ul className="mt-2 space-y-1 text-sm leading-relaxed text-fg-secondary">
      {shown.map((line) =>
        line.kind === 'item' ? (
          <li key={line.line}>
            <label
              className="flex cursor-pointer items-start gap-2"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <input
                type="checkbox"
                checked={line.checked}
                onChange={() => {
                  actions.toggleChecklistItem(note.id, line.line)
                }}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span
                className={`min-w-0 truncate ${line.checked ? 'text-fg-muted line-through' : ''}`}
              >
                {line.text}
              </span>
            </label>
          </li>
        ) : (
          <li key={line.line} className="truncate">
            {line.text}
          </li>
        ),
      )}
    </ul>
  )
}
