import type { Project, ProjectNameError } from '@devnotes/core'
import { Plus } from 'lucide-react'
import { useState, type SyntheticEvent } from 'react'
import { strings } from '../../i18n'
import { useActions } from '../../store/hooks'
import { fieldClass } from '../../ui/styles'

/** "New project" in the sidebar: opens a field for the name; Enter creates the project. */
export function NewProjectForm({ onCreated }: { onCreated: (project: Project) => void }) {
  const actions = useActions()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ProjectNameError | 'failed' | null>(null)

  const close = () => {
    setOpen(false)
    setName('')
    setError(null)
  }

  const create = async () => {
    setBusy(true)
    try {
      const result = await actions.createProject(name)
      if (typeof result === 'string') {
        setError(result)
        return
      }
      close()
      onCreated(result)
    } catch (failure) {
      console.error('DevNotes: failed to create a project', failure)
      setError('failed')
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    if (!busy) void create()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-control px-3 text-left text-[15px] text-fg-muted hover:bg-card hover:text-fg"
      >
        <Plus aria-hidden="true" size={18} />
        {strings.project.new}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="px-1 py-1">
      <input
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
        onBlur={() => {
          if (name.trim() === '' && !busy) close()
        }}
        aria-label={strings.project.nameLabel}
        aria-invalid={error !== null}
        aria-describedby={error ? 'new-project-error' : undefined}
        placeholder={strings.project.namePlaceholder}
        maxLength={80}
        autoFocus
        disabled={busy}
        className={fieldClass}
      />
      {busy && <p className="mt-1.5 px-2 text-xs text-fg-muted">{strings.project.creating}</p>}
      {error && (
        <p id="new-project-error" role="alert" className="mt-1.5 px-2 text-xs text-tag-red">
          {strings.project.errors[error]}
        </p>
      )}
    </form>
  )
}
