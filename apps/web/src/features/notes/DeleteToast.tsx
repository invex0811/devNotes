import { useEffect } from 'react'
import { strings } from '../../i18n'
import { UNDO_TIMEOUT_MS } from '../../store/appStore'
import { useActions, useApp } from '../../store/hooks'

/** "Deleted" message with an Undo button; disappears after five seconds. */
export function DeleteToast() {
  const toast = useApp((state) => state.toast)
  const actions = useActions()
  const toastId = toast?.id

  useEffect(() => {
    if (toastId === undefined) return
    const timer = window.setTimeout(() => {
      actions.dismissToast()
    }, UNDO_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [toastId, actions])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 md:bottom-5 flex justify-center px-4"
    >
      {toast && (
        <div className="pointer-events-auto flex items-center gap-4 rounded-control border border-line bg-card py-1.5 pr-1.5 pl-4 text-[15px] text-fg shadow-lg">
          <span>{strings.note.deleted}</span>
          <button
            type="button"
            onClick={() => {
              actions.undoDelete()
            }}
            className="min-h-11 rounded-control px-3 font-semibold text-accent hover:bg-panel"
          >
            {strings.note.undo}
          </button>
        </div>
      )}
    </div>
  )
}
