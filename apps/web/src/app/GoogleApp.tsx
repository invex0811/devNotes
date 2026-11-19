import { useEffect, useState } from 'react'
import { createHttpApi } from '../data/google/api'
import { CacheDb } from '../data/google/cache'
import type { GoogleConfig } from '../data/google/config'
import { createGisTokenSource } from '../data/google/gis'
import { pickSpreadsheet } from '../data/google/picker'
import { createGoogleSession, type SessionStore } from '../data/google/session'
import { strings } from '../i18n'
import { SessionContext, useSession } from '../store/sessionContext'
import { AppRoot } from './AppRoot'
import { SignIn } from './SignIn'

function createSession(config: GoogleConfig): SessionStore {
  const tokens = createGisTokenSource(config.clientId)
  const { apiKey, appId } = config
  return createGoogleSession({
    tokens,
    ...(apiKey && appId
      ? {
          pickSpreadsheet: (token: string) =>
            pickSpreadsheet({ apiKey, appId }, token, strings.connect.pickerTitle),
        }
      : {}),
    api: createHttpApi(() => tokens.getToken()),
    db: new CacheDb(),
    reload: () => {
      window.location.reload()
    },
  })
}

/** The app on Google Sheets: sign-in page first time, then notes from the cache. */
export function GoogleApp({ config }: { config: GoogleConfig }) {
  const [session] = useState(() => createSession(config))
  return <SessionApp session={session} />
}

/** The same on top of any session; tests pass one with a fake Google. */
export function SessionApp({ session }: { session: SessionStore }) {
  useEffect(() => {
    void session.getState().actions.start()
  }, [session])

  return (
    <SessionContext value={session}>
      <SessionGate />
    </SessionContext>
  )
}

function SessionGate() {
  const phase = useSession((state) => state.phase)
  const appStore = useSession((state) => state.appStore)
  const accountId = useSession((state) => state.account?.id)

  if (phase === 'starting') return <p className="p-8 text-fg-muted">{strings.common.loading}</p>
  if (phase === 'signIn' || !appStore) return <SignIn />
  return <AppRoot key={accountId} store={appStore} />
}
