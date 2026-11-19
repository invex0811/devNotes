import { AI_INSTRUCTION, parseAiImport, pluralRu, type AiImport } from '@devnotes/core'
import { Copy, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { strings } from '../../i18n'
import { useActions, useLabels } from '../../store/hooks'
import { LabelBadge } from '../../ui/LabelBadge'
import { Modal } from '../../ui/Modal'
import { ProjectChoice } from '../../ui/ProjectChoice'
import { iconButtonClass, primaryButtonClass, secondaryButtonClass } from '../../ui/styles'
import { labelColor } from '../notes/labelColor'

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="rounded-card border border-line bg-panel p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-control bg-card font-mono text-sm font-semibold text-fg"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">{title}</div>
      </div>
      {children}
    </section>
  )
}

/**
 * "Вставить от ИИ" in three steps: copy the instruction for the AI, paste its
 * answer, check the cards and add them for review.
 */
export function PasteFromAiDialog({
  defaultProjectId,
  onClose,
  onAdded,
}: {
  defaultProjectId: string | null
  onClose: () => void
  onAdded: () => void
}) {
  const actions = useActions()
  const labels = useLabels()
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId)
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)

  const result = text.trim() === '' ? null : parseAiImport(text, labels)
  const parsed: AiImport | null = result && !('error' in result) ? result : null
  const error = result && 'error' in result ? result.error : null
  const count = parsed?.notes.length ?? 0
  const forms = strings.aiImport.cardsForms

  const copyInstruction = async () => {
    try {
      await navigator.clipboard.writeText(AI_INSTRUCTION)
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }

  const add = () => {
    if (!parsed) return
    actions.importAiNotes(parsed.notes, parsed.newLabels, projectId)
    onAdded()
  }

  const colorOf = (name: string) =>
    parsed?.newLabels.some((label) => label === name) ? 'gray' : labelColor(labels, name)

  return (
    <Modal label={strings.aiImport.button} onClose={onClose} widthClass="max-w-3xl">
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-fg">{strings.aiImport.button}</h2>
            <p className="mt-1.5 text-fg-secondary">{strings.aiImport.lead}</p>
          </div>
          <button
            type="button"
            aria-label={strings.common.close}
            title={strings.common.close}
            onClick={onClose}
            className={iconButtonClass}
          >
            <X size={22} />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <Step
            number={1}
            title={
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="min-w-0 flex-1 basis-64">
                  <h3 className="font-semibold text-fg">{strings.aiImport.step1Title}</h3>
                  <p className="mt-0.5 text-sm text-fg-secondary">{strings.aiImport.step1Text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyInstruction()}
                  className={`${secondaryButtonClass} gap-2`}
                >
                  <Copy aria-hidden="true" size={18} />
                  {strings.aiImport.copyInstruction}
                </button>
              </div>
            }
          >
            {copied && (
              <p
                role="status"
                className={`mt-3 text-sm ${copied === 'ok' ? 'text-status-done' : 'text-tag-red'}`}
              >
                {copied === 'ok'
                  ? strings.aiImport.instructionCopied
                  : strings.aiImport.instructionFailed}
              </p>
            )}
          </Step>

          <Step
            number={2}
            title={
              <label htmlFor="ai-answer" className="block pt-1 font-semibold text-fg">
                {strings.aiImport.step2Title}
              </label>
            }
          >
            <textarea
              id="ai-answer"
              value={text}
              onChange={(event) => {
                setText(event.target.value)
              }}
              aria-describedby={error ? 'ai-answer-error' : undefined}
              aria-invalid={error !== null}
              placeholder={strings.aiImport.pastePlaceholder}
              rows={8}
              spellCheck={false}
              className="mt-3.5 w-full resize-y rounded-control border border-line bg-page p-3.5 font-mono text-sm leading-relaxed text-fg placeholder:text-fg-muted"
            />
            {error && (
              <div id="ai-answer-error" role="alert" className="mt-2 space-y-1 text-sm">
                <p className="text-tag-red">{strings.aiImport.errors[error]}</p>
                <p className="text-fg-secondary">{strings.aiImport.retry}</p>
              </div>
            )}
          </Step>

          {parsed && (
            <Step
              number={3}
              title={
                <h3 className="pt-1 font-semibold text-fg">
                  {strings.aiImport.recognized}: {count}{' '}
                  {pluralRu(count, forms[0], forms[1], forms[2])}
                </h3>
              }
            >
              <ul className="mt-3.5 max-h-60 divide-y divide-line overflow-y-auto rounded-control border border-line bg-page">
                {parsed.notes.map((note, index) => (
                  <li key={index} className="flex min-h-12 items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] text-fg">
                      {note.title}
                    </span>
                    {note.labels.map((name) => (
                      <LabelBadge key={name} name={name} color={colorOf(name)} />
                    ))}
                  </li>
                ))}
              </ul>
              <ImportNotes parsed={parsed} />
              <div className="mt-4">
                <ProjectChoice name="ai-import-project" value={projectId} onChange={setProjectId} />
              </div>
            </Step>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm text-fg-muted">{strings.aiImport.hint}</p>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            {strings.common.cancel}
          </button>
          <button type="button" disabled={count === 0} onClick={add} className={primaryButtonClass}>
            {strings.aiImport.submit} ({count})
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** New labels that will be created and everything that was left out. */
function ImportNotes({ parsed }: { parsed: AiImport }) {
  const lines: string[] = []
  if (parsed.newLabels.length > 0) {
    lines.push(`${strings.aiImport.newLabels} ${parsed.newLabels.join(', ')}.`)
  }
  if (parsed.droppedLabels.length > 0) {
    lines.push(`${strings.aiImport.droppedLabels} ${parsed.droppedLabels.join(', ')}.`)
  }
  if (parsed.skipped > 0) lines.push(`${strings.aiImport.skipped} ${String(parsed.skipped)}.`)
  if (parsed.overLimit > 0) lines.push(`${strings.aiImport.overLimit} ${String(parsed.overLimit)}.`)
  if (lines.length === 0) return null
  return (
    <ul className="mt-3 space-y-1 text-sm text-status-wip">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}
