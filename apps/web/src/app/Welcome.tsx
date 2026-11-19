import { strings } from '../i18n'
import { Logo } from '../ui/Logo'
import { primaryButtonClass } from '../ui/styles'

/**
 * Shown without `?demo=1` when the build has no Google keys (a fresh checkout
 * without `.env.local`): there is no storage to work with, so it leads to the demo.
 */
export function Welcome() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-12">
      <Logo />
      <h1 className="mt-8 text-4xl leading-tight font-bold tracking-tight text-fg">
        {strings.welcome.title}
      </h1>
      <p className="mt-4 text-lg text-fg-secondary">{strings.welcome.lead}</p>
      <div className="mt-8">
        <a href="?demo=1" className={primaryButtonClass}>
          {strings.welcome.openDemo}
        </a>
      </div>
      <p className="mt-6 text-sm text-fg-muted">{strings.welcome.demoHint}</p>
    </main>
  )
}
