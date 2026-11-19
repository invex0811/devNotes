import { Link2 } from 'lucide-react'
import { useState } from 'react'
import type { ConnectOutcome } from '../../data/google/session'
import { strings } from '../../i18n'
import { useSession } from '../../store/sessionContext'

type ConnectError = Extract<NonNullable<ConnectOutcome>, { error: string }>['error']

/** "Connect a shared project": Google Picker, then the project appears in the list. */
export function ConnectProjectButton({
  onConnected,
}: {
  onConnected: (projectId: string) => void
}) {
  const actions = useSession((state) => state.actions)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ConnectError | null>(null)

  const connect = async () => {
    setBusy(true)
    setError(null)
    const outcome = await actions.connectProject()
    setBusy(false)
    if (outcome === null) return
    if ('error' in outcome) setError(outcome.error)
    else onConnected(outcome.projectId)
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => void connect()}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-control px-3 text-left text-[15px] text-fg-muted hover:bg-card hover:text-fg disabled:opacity-60"
      >
        <Link2 aria-hidden="true" size={18} />
        {busy ? strings.connect.busy : strings.connect.button}
      </button>
      {error && (
        <p role="alert" className="mt-1 px-3 text-xs text-tag-red">
          {strings.connect.errors[error]}
        </p>
      )}
    </>
  )
}
