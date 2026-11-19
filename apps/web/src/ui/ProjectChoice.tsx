import { strings } from '../i18n'
import { useProjects } from '../store/hooks'

/** Value of the "no project" choice; real project ids are never empty. */
const NO_PROJECT = ''

interface ProjectChoiceProps {
  /** Radio group name, unique on the page. */
  name: string
  value: string | null
  onChange: (projectId: string | null) => void
}

/** The "В проект:" row of chips: "Без проекта" and every project in the list. */
export function ProjectChoice({ name, value, onChange }: ProjectChoiceProps) {
  const projects = useProjects()
  const choices = [
    { value: NO_PROJECT, name: strings.project.none },
    ...projects.map((project) => ({ value: project.id, name: project.name })),
  ]

  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="float-left mr-1 text-sm text-fg-secondary">
        {strings.quickAdd.toProject}
      </legend>
      {choices.map((choice) => (
        <label key={choice.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={(value ?? NO_PROJECT) === choice.value}
            onChange={() => {
              onChange(choice.value === NO_PROJECT ? null : choice.value)
            }}
            className="peer sr-only"
          />
          <span className="inline-flex min-h-8 items-center rounded-full border border-line px-3 text-sm text-fg-secondary peer-checked:border-accent peer-checked:font-semibold peer-checked:text-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:text-fg">
            {choice.name}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
