import { LogIn } from 'lucide-react'
import { strings } from '../i18n'
import { useSession } from '../store/sessionContext'
import { Logo } from '../ui/Logo'
import { primaryButtonClass } from '../ui/styles'

/** First visit: what DevNotes is, the Google button and what happens with the data. */
export function SignIn() {
  const actions = useSession((state) => state.actions)
  const ready = useSession((state) => state.ready)
  const busy = useSession((state) => state.busy)
  const error = useSession((state) => state.error)

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-12">
      <Logo />
      <h1 className="mt-8 text-4xl leading-tight font-bold tracking-tight text-fg md:text-5xl">
        {strings.welcome.title}
      </h1>
      <p className="mt-4 text-lg text-fg-secondary">{strings.signIn.lead}</p>

      <div className="mt-8">
        <button
          type="button"
          disabled={!ready || busy}
          onClick={actions.signIn}
          className={`${primaryButtonClass} gap-3 px-6 text-base`}
        >
          <LogIn aria-hidden="true" size={20} />
          {busy ? strings.signIn.busy : strings.signIn.button}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-tag-red">
            {strings.signIn.errors[error]}
          </p>
        )}
      </div>

      <ol
        aria-label={strings.signIn.stepsLabel}
        className="mt-8 divide-y divide-line overflow-hidden rounded-dialog border border-line bg-panel"
      >
        {strings.signIn.steps.map((step, index) => (
          <li key={step} className="flex gap-4 px-5 py-4 text-fg-secondary">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-control bg-card font-mono text-sm font-semibold text-fg"
            >
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-sm text-fg-muted">{strings.signIn.shareHint}</p>
    </main>
  )
}
