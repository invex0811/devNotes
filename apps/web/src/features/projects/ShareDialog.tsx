import type { Project } from '@devnotes/core'
import { useState, type SyntheticEvent } from 'react'
import type { ShareError } from '../../data/google/session'
import { strings } from '../../i18n'
import { useSession } from '../../store/sessionContext'
import { Modal } from '../../ui/Modal'
import { fieldClass, primaryButtonClass, secondaryButtonClass } from '../../ui/styles'

/** "Share": gives a Google account edit access to the project spreadsheet. */
export function ShareDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const actions = useSession((state) => state.actions)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ShareError | null>(null)
  const [sharedWith, setSharedWith] = useState<string[]>([])

  const share = async () => {
    setBusy(true)
    const result = await actions.shareProject(project.id, email)
    setBusy(false)
    setError(result)
    if (result === null) {
      setSharedWith([...sharedWith, email.trim()])
      setEmail('')
    }
  }

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    if (!busy) void share()
  }

  return (
    <Modal label={`${strings.share.title}: ${project.name}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-fg">
          {strings.share.title} «{project.name}»
        </h2>
        <p className="text-fg-secondary">{strings.share.lead}</p>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-fg">{strings.share.emailLabel}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError(null)
            }}
            placeholder={strings.share.emailPlaceholder}
            autoComplete="off"
            autoFocus
            disabled={busy}
            aria-invalid={error !== null}
            aria-describedby={error ? 'share-error' : undefined}
            className={fieldClass}
          />
        </label>
        {error && (
          <p id="share-error" role="alert" className="text-sm text-tag-red">
            {strings.share.errors[error]}
          </p>
        )}
        {sharedWith.length > 0 && (
          <p role="status" className="text-sm text-status-done">
            {strings.share.done}: {sharedWith.join(', ')}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            {strings.common.close}
          </button>
          <button
            type="submit"
            disabled={busy || email.trim() === ''}
            className={primaryButtonClass}
          >
            {busy ? strings.share.busy : strings.share.submit}
          </button>
        </div>
      </form>
    </Modal>
  )
}
