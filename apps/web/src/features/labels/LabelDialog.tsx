import { LABEL_COLORS, type Label, type LabelColor, type LabelNameError } from '@devnotes/core'
import { useState, type SyntheticEvent } from 'react'
import { strings } from '../../i18n'
import { useActions } from '../../store/hooks'
import { Modal } from '../../ui/Modal'
import {
  dangerButtonClass,
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../ui/styles'
import { TAG_SOLID } from '../../ui/theme'

interface LabelDialogProps {
  /** The label being edited; omit to create a new one. */
  label?: Label
  onClose: () => void
}

/** Create a label, or rename, recolor and delete one of the user's own labels. */
export function LabelDialog({ label, onClose }: LabelDialogProps) {
  const actions = useActions()
  const [name, setName] = useState(label?.name ?? '')
  const [color, setColor] = useState<LabelColor>(label?.color ?? 'green')
  const [error, setError] = useState<LabelNameError | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const result = label
      ? actions.updateLabel(label.name, name, color)
      : actions.createLabel(name, color)
    if (result === null) onClose()
    else setError(result)
  }

  const title = label ? strings.label.editTitle : strings.label.newTitle

  return (
    <Modal label={title} onClose={onClose}>
      <form onSubmit={submit} className="p-6">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm text-fg-secondary">{strings.label.nameLabel}</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            placeholder={strings.label.namePlaceholder}
            maxLength={40}
            autoFocus
            aria-invalid={error !== null}
            aria-describedby={error ? 'label-name-error' : undefined}
            className={fieldClass}
          />
        </label>
        {error && (
          <p id="label-name-error" role="alert" className="mt-2 text-sm text-tag-red">
            {strings.label.errors[error]}
          </p>
        )}

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm text-fg-secondary">{strings.label.colorLabel}</legend>
          <div className="flex flex-wrap gap-2.5">
            {LABEL_COLORS.map((option) => (
              <label key={option} title={strings.label.colors[option]} className="cursor-pointer">
                <input
                  type="radio"
                  name="label-color"
                  value={option}
                  checked={color === option}
                  onChange={() => {
                    setColor(option)
                  }}
                  aria-label={strings.label.colors[option]}
                  className="peer sr-only"
                />
                <span
                  className={`block size-8 rounded-md outline-offset-2 peer-checked:outline-2 peer-checked:outline-fg peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${TAG_SOLID[option]}`}
                />
              </label>
            ))}
          </div>
        </fieldset>

        {label && confirmingDelete && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-page p-3">
            <p className="text-sm text-fg-secondary">{strings.label.deleteConfirm}</p>
            <button
              type="button"
              onClick={() => {
                actions.deleteLabel(label.name)
                onClose()
              }}
              className={dangerButtonClass}
            >
              {strings.label.deleteConfirmButton}
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {label && !confirmingDelete && (
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(true)
              }}
              className={`${dangerButtonClass} mr-auto`}
            >
              {strings.label.delete}
            </button>
          )}
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            {strings.common.cancel}
          </button>
          <button type="submit" className={primaryButtonClass}>
            {label ? strings.common.save : strings.common.create}
          </button>
        </div>
      </form>
    </Modal>
  )
}
