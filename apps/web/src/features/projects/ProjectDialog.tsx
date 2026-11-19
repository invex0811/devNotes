import type { Project, ProjectNameError } from '@devnotes/core'
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

interface ProjectDialogProps {
  project: Project
  onClose: () => void
  /** Called after the project was removed from the list. */
  onRemoved: (project: Project) => void
}

/** Rename a project or remove it from the list. */
export function ProjectDialog({ project, onClose, onRemoved }: ProjectDialogProps) {
  const actions = useActions()
  const [name, setName] = useState(project.name)
  const [error, setError] = useState<ProjectNameError | null>(null)

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const result = actions.renameProject(project.id, name)
    if (result === null) onClose()
    else setError(result)
  }

  return (
    <Modal label={strings.project.dialogTitle} onClose={onClose}>
      <form onSubmit={submit} className="p-6">
        <h2 className="text-xl font-bold tracking-tight">{strings.project.dialogTitle}</h2>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm text-fg-secondary">
            {strings.project.nameLabel}
          </span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            maxLength={80}
            autoFocus
            aria-invalid={error !== null}
            aria-describedby={error ? 'project-name-error' : undefined}
            className={fieldClass}
          />
        </label>
        {error && (
          <p id="project-name-error" role="alert" className="mt-2 text-sm text-tag-red">
            {strings.project.errors[error]}
          </p>
        )}

        <div className="mt-6 rounded-control border border-line bg-page p-3">
          <p className="text-sm text-fg-secondary">{strings.project.removeHint}</p>
          <button
            type="button"
            onClick={() => {
              actions.removeProject(project.id)
              onRemoved(project)
            }}
            className={`${dangerButtonClass} mt-3`}
          >
            {strings.project.remove}
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            {strings.common.cancel}
          </button>
          <button type="submit" className={primaryButtonClass}>
            {strings.common.save}
          </button>
        </div>
      </form>
    </Modal>
  )
}
