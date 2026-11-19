import { findLabel, parseQuickInput } from '@devnotes/core'
import { Plus } from 'lucide-react'
import { useState, type SyntheticEvent } from 'react'
import { strings } from '../../i18n'
import { useActions, useLabels } from '../../store/hooks'
import { LabelBadge } from '../../ui/LabelBadge'
import { ProjectChoice } from '../../ui/ProjectChoice'
import { fieldClass, primaryButtonClass } from '../../ui/styles'
import { useFittingPlaceholder } from '../../ui/useFittingPlaceholder'

/**
 * Quick input at the top of the screen. Enter saves a note with the status "new";
 * a prefix like "баг:" sets the label. `defaultProjectId` is the open project.
 */
export function QuickAdd({ defaultProjectId }: { defaultProjectId: string | null }) {
  const actions = useActions()
  const labels = useLabels()
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId)
  const [placeholder, attachField] = useFittingPlaceholder(
    strings.quickAdd.placeholder,
    strings.quickAdd.placeholderShort,
  )

  const parsed = parseQuickInput(text, labels)
  const label = parsed.label === null ? undefined : findLabel(labels, parsed.label)

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    if (actions.addNote(text, projectId)) setText('')
  }

  return (
    <form onSubmit={submit} className="rounded-dialog border border-line bg-panel p-3.5 sm:p-4">
      <div className="flex gap-2.5">
        <input
          ref={attachField}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
          aria-label={strings.quickAdd.label}
          aria-describedby="quick-add-hint"
          placeholder={placeholder}
          autoComplete="off"
          className={fieldClass}
        />
        <button
          type="submit"
          aria-label={strings.quickAdd.add}
          className={`${primaryButtonClass} shrink-0 max-sm:w-11 max-sm:px-0`}
        >
          <Plus aria-hidden="true" size={22} className="sm:hidden" />
          <span className="max-sm:hidden">{strings.quickAdd.add}</span>
        </button>
      </div>

      <div className={`mt-3 ${text === '' ? 'max-md:hidden' : ''}`}>
        <ProjectChoice name="quick-add-project" value={projectId} onChange={setProjectId} />
      </div>

      <p
        id="quick-add-hint"
        aria-live="polite"
        className={`mt-3 flex min-h-7 flex-wrap items-center gap-2 text-sm text-fg-muted ${text === '' ? 'max-md:hidden' : ''}`}
      >
        {label ? (
          <>
            {strings.quickAdd.willLabel}
            <LabelBadge name={label.name} color={label.color} />
          </>
        ) : (
          strings.quickAdd.hint
        )}
      </p>
    </form>
  )
}
