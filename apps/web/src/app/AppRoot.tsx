import { useEffect } from 'react'
import { strings } from '../i18n'
import type { AppStore } from '../store/appStore'
import { AppStoreProvider } from '../store/AppStoreProvider'
import { useApp } from '../store/hooks'
import { AppShell } from './AppShell'

/** The application itself, on top of any store (demo or, later, Google). */
export function AppRoot({ store }: { store: AppStore }) {
  useEffect(() => {
    void store.getState().actions.load()
  }, [store])

  return (
    <AppStoreProvider store={store}>
      <Gate />
    </AppStoreProvider>
  )
}

function Gate() {
  const phase = useApp((state) => state.phase)
  if (phase === 'loading') {
    return <p className="p-8 text-fg-muted">{strings.common.loading}</p>
  }
  return <AppShell />
}
