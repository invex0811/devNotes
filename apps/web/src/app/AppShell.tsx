import type { ReactNode } from 'react'
import { strings } from '../i18n'
import { Logo } from '../ui/Logo'

interface AppShellProps {
  title: string
  children: ReactNode
}

/** Page frame: sidebar on wide screens, a top bar with the logo on narrow ones. */
export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-page md:flex-row">
      <aside
        aria-label={strings.shell.sidebarLabel}
        className="flex shrink-0 items-center border-b border-divider bg-sidebar px-4 py-3 md:w-60 md:flex-col md:items-stretch md:border-r md:border-b-0 md:px-5 md:py-6"
      >
        <Logo />
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-7">
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {children}
      </main>
    </div>
  )
}
