import { describe, expect, it } from 'vitest'
import { activeProjects, isSharedProject, validateProjectName, type Project } from './project'

const base: Project = {
  id: 'a',
  name: 'A',
  spreadsheetId: '',
  role: 'owner',
  order: 0,
  addedAt: '2026-11-01T00:00:00.000Z',
  removed: false,
}

describe('projects', () => {
  it('validates names', () => {
    expect(validateProjectName('  ')).toBe('empty')
    expect(validateProjectName('x'.repeat(81))).toBe('too_long')
    expect(validateProjectName(' Платформер ')).toBeNull()
  })

  it('lists active projects in the user’s order', () => {
    const projects = [
      { ...base, id: 'c', order: 2 },
      { ...base, id: 'removed', order: 0, removed: true },
      { ...base, id: 'b', order: 1 },
    ]
    expect(activeProjects(projects).map((p) => p.id)).toEqual(['b', 'c'])
  })
})

describe('shared projects', () => {
  it('treats a member project and a shared own project as shared', () => {
    expect(isSharedProject(base)).toBe(false)
    expect(isSharedProject({ ...base, shared: true })).toBe(true)
    expect(isSharedProject({ ...base, role: 'member' })).toBe(true)
  })
})
