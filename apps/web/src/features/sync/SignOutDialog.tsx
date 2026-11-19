import { useEffect, useState } from 'react'
import { strings } from '../../i18n'
import { useSession } from '../../store/sessionContext'
import { Modal } from '../../ui/Modal'
import { dangerButtonClass, secondaryButtonClass } from '../../ui/styles'

/** "Sign out?" Warns first when some edits have not reached the spreadsheet yet. */
export function SignOutDialog({ onClose }: { onClose: () => void }) {
  const actions = useSession((state) => state.actions)
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    actions.hasPending().then(
      (value) => {
        if (active) setPending(value)
      },
      () => {
        // The cache is gone (already signed out): nothing is pending.
      },
    )
    return () => {
      active = false
    }
  }, [actions])

  return (
    <Modal label={strings.signOut.title} onClose={onClose}>
      <div className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-fg">{strings.signOut.title}</h2>
        <p className="text-fg-secondary">{strings.signOut.text}</p>
        {pending && (
          <p role="alert" className="text-tag-red">
            {strings.signOut.pending}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            {strings.common.cancel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void actions.signOut()
            }}
            className={dangerButtonClass}
          >
            {strings.signOut.confirm}
          </button>
        </div>
      </div>
    </Modal>
  )
}
