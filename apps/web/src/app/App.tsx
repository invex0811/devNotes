import { strings } from '../i18n'
import { AppShell } from './AppShell'

export function App() {
  return (
    <AppShell title={strings.shell.allNotes}>
      <section className="mt-6 rounded-card border border-line bg-panel px-6 py-10 text-center">
        <p className="text-base font-semibold text-fg">{strings.shell.emptyTitle}</p>
        <p className="mt-2 text-sm text-fg-muted">{strings.shell.emptyHint}</p>
      </section>
    </AppShell>
  )
}
