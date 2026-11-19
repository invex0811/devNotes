import { z } from 'zod'

export const PROJECT_NAME_MAX_LENGTH = 80

/** A row of the `projects` sheet in the user's home spreadsheet. */
export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH),
  spreadsheetId: z.string(),
  role: z.enum(['owner', 'member']),
  order: z.number().int(),
  addedAt: z.iso.datetime(),
  /** "Remove from list" hides the project in the app; the spreadsheet stays on Drive. */
  removed: z.boolean(),
})
export type Project = z.infer<typeof projectSchema>

export type ProjectNameError = 'empty' | 'too_long'

export function validateProjectName(name: string): ProjectNameError | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'empty'
  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) return 'too_long'
  return null
}

/** Projects shown in the app, in the user's order. */
export function activeProjects(projects: readonly Project[]): Project[] {
  return projects
    .filter((project) => !project.removed)
    .toSorted((a, b) => a.order - b.order || a.addedAt.localeCompare(b.addedAt))
}
