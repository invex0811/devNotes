import { LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { strings } from '../../i18n'
import { useSession } from '../../store/sessionContext'
import { SignOutDialog } from './SignOutDialog'
import { SyncIndicator } from './SyncIndicator'

const smallIconButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg-muted hover:bg-card hover:text-fg disabled:opacity-50'

/** Bottom of the sidebar: the Google account, the sync indicator, refresh and sign-out. */
export function AccountPanel() {
  const account = useSession((state) => state.account)
  const sync = useSession((state) => state.sync)
  const auth = useSession((state) => state.auth)
  const refreshing = useSession((state) => state.refreshing)
  const actions = useSession((state) => state.actions)
  const [signingOut, setSigningOut] = useState(false)

  const name = account && account.name !== '' ? account.name : strings.sync.account
  const initial = name.trim().charAt(0).toUpperCase()

  return (
    <div className="border-t border-divider pt-4 pl-3">
      <div className="flex items-center gap-2">
        {account?.photoUrl ? (
          <img
            src={account.photoUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-9 shrink-0 rounded-full bg-card"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card font-semibold text-fg"
          >
            {initial}
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg" title={account?.email}>
          {name}
        </p>
        <button
          type="button"
          aria-label={strings.sync.refresh}
          title={strings.sync.refresh}
          disabled={refreshing || auth !== 'ok'}
          onClick={() => {
            void actions.refresh()
          }}
          className={smallIconButton}
        >
          <RefreshCw aria-hidden="true" size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          aria-label={strings.sync.signOut}
          title={strings.sync.signOut}
          onClick={() => {
            setSigningOut(true)
          }}
          className={`${smallIconButton} -ml-2`}
        >
          <LogOut aria-hidden="true" size={16} />
        </button>
      </div>
      <div className="mt-1.5 pr-3">
        <SyncIndicator sync={sync} auth={auth} />
      </div>
      {signingOut && (
        <SignOutDialog
          onClose={() => {
            setSigningOut(false)
          }}
        />
      )}
    </div>
  )
}
