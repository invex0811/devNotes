import { Check, Copy } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { strings } from '../../i18n'

type System = 'windows' | 'unix'

/** The MCP package is built and published with the site only when the owner set it up. */
function mcpAvailable(): boolean {
  return import.meta.env.VITE_DEVNOTES_MCP === '1'
}

/** The package the site publishes next to itself (see packages/mcp/build.mjs). */
function packageUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}devnotes-mcp.tgz`
}

function installCommand(system: System): string {
  const npx = system === 'windows' ? 'cmd /c npx' : 'npx'
  return `claude mcp add --transport stdio --scope user devnotes -- ${npx} -y ${packageUrl()}`
}

function CommandLine({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3 flex flex-col rounded-control border border-line bg-page sm:flex-row sm:items-stretch">
      <code
        aria-label={label}
        className="min-w-0 flex-1 px-3.5 py-3 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap text-fg"
      >
        {command}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(command).then(
            () => {
              setCopied(true)
            },
            () => {
              setCopied(false)
            },
          )
        }}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border-t border-line px-3.5 text-sm font-semibold text-fg-secondary hover:text-fg sm:border-t-0 sm:border-l"
      >
        {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
        {copied ? strings.claudeCode.copied : strings.claudeCode.copy}
      </button>
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-card border border-line bg-panel p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-control bg-card font-mono text-sm font-semibold text-fg"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="pt-1 font-semibold text-fg">{title}</h2>
          {children}
        </div>
      </div>
    </li>
  )
}

/** "Подключить Claude Code": how anyone using this site connects the MCP server. */
export function ClaudeCodePage() {
  const [system, setSystem] = useState<System>(() =>
    navigator.userAgent.includes('Windows') ? 'windows' : 'unix',
  )
  const text = strings.claudeCode

  return (
    <section aria-label={text.title} className="max-w-3xl space-y-5">
      <p className="text-fg-secondary">{text.lead}</p>

      {!mcpAvailable() ? (
        <p
          role="note"
          className="rounded-card border border-line bg-panel px-5 py-4 text-fg-secondary"
        >
          {text.unavailable}
        </p>
      ) : (
        <>
          <ol className="space-y-3.5">
            <Step number={1} title={text.step1Title}>
              <p className="mt-1 text-sm text-fg-secondary">
                {text.step1Text}{' '}
                <a
                  href="https://code.claude.com/docs/en/setup"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  Claude Code
                </a>
                {' · '}
                <a
                  href="https://nodejs.org/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  Node.js
                </a>
              </p>
            </Step>

            <Step number={2} title={text.step2Title}>
              <p className="mt-1 text-sm text-fg-secondary">{text.step2Text}</p>
              <div
                role="group"
                aria-label={text.systemLabel}
                className="mt-3 inline-flex overflow-hidden rounded-control border border-line"
              >
                {(['windows', 'unix'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={system === option}
                    onClick={() => {
                      setSystem(option)
                    }}
                    className={`min-h-11 px-4 text-sm font-semibold ${system === option ? 'bg-card text-fg' : 'text-fg-muted hover:text-fg'}`}
                  >
                    {text[option]}
                  </button>
                ))}
              </div>
              <CommandLine command={installCommand(system)} label={text.step2Title} />
            </Step>

            <Step number={3} title={text.step3Title}>
              <p className="mt-1 text-sm text-fg-secondary">{text.step3Text}</p>
              <CommandLine command="claude mcp list" label={text.step3Title} />
            </Step>

            <Step number={4} title={text.step4Title}>
              <p className="mt-1 text-sm text-fg-secondary">{text.step4Text}</p>
              <ul className="mt-3 space-y-1.5 text-[15px] text-fg">
                {text.examples.map((example) => (
                  <li key={example}>«{example}»</li>
                ))}
              </ul>
            </Step>
          </ol>

          <div className="rounded-card border border-line bg-panel p-4 sm:p-5">
            <h2 className="font-semibold text-fg">{text.notesTitle}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-fg-secondary">
              {text.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-fg-secondary">{text.removeLabel}:</p>
            <CommandLine
              command="claude mcp remove devnotes --scope user"
              label={text.removeLabel}
            />
          </div>
        </>
      )}
    </section>
  )
}
