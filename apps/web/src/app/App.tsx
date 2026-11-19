import { useState } from 'react'
import { readGoogleConfig } from '../data/google/config'
import { createDemoData } from '../data/demoData'
import { createMemoryStore } from '../data/memoryStore'
import { createAppStore } from '../store/appStore'
import { AppRoot } from './AppRoot'
import { GoogleApp } from './GoogleApp'
import { isDemoMode } from './router'
import { Welcome } from './Welcome'

export function App() {
  if (isDemoMode(window.location.search)) return <DemoApp />
  const google = readGoogleConfig()
  // Without keys (a fresh checkout) the site can still be tried in the demo mode.
  if (!google) return <Welcome />
  return <GoogleApp config={google} />
}

/** `?demo=1`: the whole app on top of an in-memory store with sample notes. */
function DemoApp() {
  const [store] = useState(() =>
    createAppStore({ dataStore: createMemoryStore({ initial: createDemoData(new Date()) }) }),
  )
  return <AppRoot store={store} />
}
