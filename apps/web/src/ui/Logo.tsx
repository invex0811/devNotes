import { Code } from 'lucide-react'
import { strings } from '../i18n'

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-md bg-accent text-on-accent"
      >
        <Code size={16} strokeWidth={3} />
      </span>
      <span className="font-mono text-base font-medium text-fg">{strings.appName}</span>
    </div>
  )
}
