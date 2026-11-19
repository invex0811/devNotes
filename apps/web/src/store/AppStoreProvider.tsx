import type { ReactNode } from 'react'
import type { AppStore } from './appStore'
import { AppStoreContext } from './storeContext'

export function AppStoreProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  return <AppStoreContext value={store}>{children}</AppStoreContext>
}
