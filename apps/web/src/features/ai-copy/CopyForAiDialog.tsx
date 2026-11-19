import { buildAiText, pluralRu, type Note } from '@devnotes/core'
import { Copy, X } from 'lucide-react'
import { useState } from 'react'
import { strings } from '../../i18n'
import { useLabels, useProjectName } from '../../store/hooks'
import { LabelBadge } from '../../ui/LabelBadge'
import { Modal } from '../../ui/Modal'
import { iconButtonClass, primaryButtonClass, secondaryButtonClass } from '../../ui/styles'
import { labelColor } from '../notes/labelColor'

const sectionTitle = 'font-mono text-[11px] font-medium tracking-[0.12em] text-fg-muted uppercase'

/**
 * "Скопировать для ИИ": the notes with checkboxes, the text that will be copied,
 * and the copy button. The text is built by `buildAiText` from the core package.
 */
export function CopyForAiDialog({
  notes,
  onClose,
}: {
  notes: readonly Note[]
  onClose: () => void
}) {
  const labels = useLabels()
  const projectName = useProjectName()
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set())
  const [result, setResult] = useState<'copied' | 'failed' | null>(null)

  const chosen = notes.filter((note) => !unchecked.has(note.id))
  const text = buildAiText(
    chosen.map((note) => ({ note, projectName: projectName(note.projectId) })),
  )

  const toggle = (id: string) => {
    const next = new Set(unchecked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setUnchecked(next)
    setResult(null)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setResult('copied')
    } catch {
      setResult('failed')
    }
  }

  const forms = strings.aiCopy.notesForms
  const count = chosen.length

  return (
    <Modal label={strings.aiCopy.button} onClose={onClose} widthClass="max-w-3xl">
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-fg">{strings.aiCopy.button}</h2>
            <p className="mt-1.5 text-fg-secondary">{strings.aiCopy.lead}</p>
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

        {notes.length === 0 ? (
          <p className="mt-6 text-fg-muted">{strings.aiCopy.noNotes}</p>
        ) : (
          <>
            <h3 className={`${sectionTitle} mt-6 mb-2`}>
              {strings.aiCopy.selected}: {count} {pluralRu(count, forms[0], forms[1], forms[2])}
            </h3>
            <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-card border border-line bg-panel">
              {notes.map((note) => (
                <li key={note.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={!unchecked.has(note.id)}
                      onChange={() => {
                        toggle(note.id)
                      }}
                      className="size-4 shrink-0 accent-accent"
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] text-fg">
                      {note.title || strings.note.untitled}
                    </span>
                    {note.labels.map((name) => (
                      <LabelBadge key={name} name={name} color={labelColor(labels, name)} />
                    ))}
                  </label>
                </li>
              ))}
            </ul>

            <h3 className={`${sectionTitle} mt-6 mb-2`}>{strings.aiCopy.preview}</h3>
            <textarea
              readOnly
              value={count === 0 ? '' : text}
              placeholder={strings.aiCopy.nothingSelected}
              aria-label={strings.aiCopy.preview}
              rows={12}
              className="w-full resize-y rounded-card border border-line bg-page p-4 font-mono text-sm leading-relaxed text-fg placeholder:text-fg-muted"
            />
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p
            role="status"
            className={`mr-auto text-sm ${result === 'failed' ? 'text-tag-red' : result === 'copied' ? 'text-status-done' : 'text-fg-muted'}`}
          >
            {result === 'copied'
              ? strings.aiCopy.copied
              : result === 'failed'
                ? strings.aiCopy.copyFailed
                : strings.aiCopy.hint}
          </p>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            {strings.common.cancel}
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => void copy()}
            className={`${primaryButtonClass} gap-2`}
          >
            <Copy aria-hidden="true" size={18} />
            {strings.aiCopy.copy}
          </button>
        </div>
      </div>
    </Modal>
  )
}
