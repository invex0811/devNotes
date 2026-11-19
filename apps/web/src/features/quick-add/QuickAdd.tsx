import { findLabel, parseQuickInput } from '@devnotes/core'
import { useState, type SyntheticEvent } from 'react'
import { strings } from '../../i18n'
import { useActions, useLabels, useProjects } from '../../store/hooks'
import { LabelBadge } from '../../ui/LabelBadge'
import { fieldClass, primaryButtonClass } from '../../ui/styles'

/** Value of the "no project" choice; real project ids are never empty. */
const NO_PROJECT = ''

/**
 * Quick input at the top of the screen. Enter saves a note with the status "new";
 * a prefix like "баг:" sets the label. `defaultProjectId` is the open project.
 */
export function QuickAdd({ defaultProjectId }: { defaultProjectId: string | null }) {
  const actions = useActions()
  const labels = useLabels()
  const projects = useProjects()
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId)

  const parsed = parseQuickInput(text, labels)
  const label = parsed.label === null ? undefined : findLabel(labels, parsed.label)

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    if (actions.addNote(text, projectId)) setText('')
  }

  const choices = [
    { value: NO_PROJECT, name: strings.project.none },
    ...projects.map((project) => ({ value: project.id, name: project.name })),
  ]

  return (
    <form onSubmit={submit} className="rounded-dialog border border-line bg-panel p-3.5 sm:p-4">
      <div className="flex gap-2.5">
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
          aria-label={strings.quickAdd.label}
          aria-describedby="quick-add-hint"
          placeholder={strings.quickAdd.placeholder}
          autoComplete="off"
          className={fieldClass}
        />
        <button type="submit" className={primaryButtonClass}>
          {strings.quickAdd.add}
        </button>
      </div>

      <fieldset className="mt-3 flex flex-wrap items-center gap-2">
        <legend className="float-left mr-1 text-sm text-fg-secondary">
          {strings.quickAdd.toProject}
        </legend>
        {choices.map((choice) => (
          <label key={choice.value} className="cursor-pointer">
            <input
              type="radio"
              name="quick-add-project"
              value={choice.value}
              checked={(projectId ?? NO_PROJECT) === choice.value}
              onChange={() => {
                setProjectId(choice.value === NO_PROJECT ? null : choice.value)
              }}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-8 items-center rounded-full border border-line px-3 text-sm text-fg-secondary peer-checked:border-accent peer-checked:font-semibold peer-checked:text-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:text-fg">
              {choice.name}
            </span>
          </label>
        ))}
      </fieldset>

      <p
        id="quick-add-hint"
        aria-live="polite"
        className="mt-3 flex min-h-7 flex-wrap items-center gap-2 text-sm text-fg-muted"
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
