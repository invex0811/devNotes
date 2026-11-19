import { strings } from '../../i18n'
import { useSession } from '../../store/sessionContext'
import { primaryButtonClass } from '../../ui/styles'

/**
 * Above the notes when there is no working token: "Continue" for a returning
 * user who sees the cache, "Session expired — Renew" after a 401.
 */
export function SessionBanner() {
  const auth = useSession((state) => state.auth)
  const busy = useSession((state) => state.busy)
  const ready = useSession((state) => state.ready)
  const error = useSession((state) => state.error)
  const actions = useSession((state) => state.actions)
  if (auth === 'ok') return null

  const expired = auth === 'expired'
  return (
    <section
      aria-label={expired ? strings.session.expiredTitle : strings.session.continueTitle}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-line bg-panel px-5 py-4"
    >
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="font-semibold text-fg">
          {expired ? strings.session.expiredTitle : strings.session.continueTitle}
        </h2>
        <p className="mt-0.5 text-sm text-fg-secondary">
          {expired ? strings.session.expiredText : strings.session.continueText}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-tag-red">
            {strings.signIn.errors[error]}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={!ready || busy}
        onClick={actions.renew}
        className={primaryButtonClass}
      >
        {expired ? strings.session.renew : strings.session.continue}
      </button>
    </section>
  )
}
