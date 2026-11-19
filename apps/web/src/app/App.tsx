import { useState } from 'react'
import { createDemoData } from '../data/demoData'
import { createMemoryStore } from '../data/memoryStore'
import { createAppStore } from '../store/appStore'
import { AppRoot } from './AppRoot'
import { isDemoMode } from './router'
import { Welcome } from './Welcome'

export function App() {
  if (!isDemoMode(window.location.search)) return <Welcome />
  return <DemoApp />
}

/** `?demo=1`: the whole app on top of an in-memory store with sample notes. */
function DemoApp() {
  const [store] = useState(() =>
    createAppStore({ dataStore: createMemoryStore({ initial: createDemoData(new Date()) }) }),
  )
  return <AppRoot store={store} />
}
