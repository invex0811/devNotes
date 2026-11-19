import type { AuthState } from '../../data/google/session'
import type { SyncStatus } from '../../data/google/sync'
import { strings } from '../../i18n'

const DOT: Record<SyncStatus, string> = {
  synced: 'bg-status-done',
  saving: 'bg-status-wip',
  offline: 'bg-status-new',
  auth: 'bg-tag-red',
}

/** One line under the account name: what is happening with the spreadsheet. */
export function SyncIndicator({ sync, auth }: { sync: SyncStatus; auth: AuthState }) {
  const state: SyncStatus = auth === 'ok' ? sync : 'auth'
  return (
    <p role="status" className="flex items-start gap-1.5 font-mono text-xs text-fg-muted">
      <span aria-hidden="true" className={`mt-1 size-1.5 shrink-0 rounded-full ${DOT[state]}`} />
      <span>{strings.sync[state]}</span>
    </p>
  )
}
