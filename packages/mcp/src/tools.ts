import { NOTE_STATUSES, type Note } from '@devnotes/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleError } from './google'
import { LoginRequiredError } from './oauth'
import {
  DEFAULT_LIST_LIMIT,
  MAX_CREATE,
  MAX_LIST_LIMIT,
  UserError,
  type DevNotesStore,
} from './store'

/** Gives the store, or throws LoginRequiredError when the user has not signed in. */
export type StoreSource = () => Promise<DevNotesStore>

const EXCERPT_LENGTH = 280

function compact(note: Note) {
  const body = note.body.trim()
  return {
    id: note.id,
    title: note.title,
    status: note.status,
    labels: note.labels,
    excerpt: body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH)}…` : body,
    hasSolution: note.solution.trim() !== '',
    pendingReview: note.review === 'pending',
    updatedAt: note.updatedAt,
  }
}

function full(note: Note) {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    status: note.status,
    labels: note.labels,
    solution: note.solution,
    color: note.color,
    pinned: note.pinned,
    source: note.source,
    pendingReview: note.review === 'pending',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
})

/** Runs a tool and turns known problems into a readable error result. */
async function answer(work: () => Promise<unknown>) {
  try {
    return json(await work())
  } catch (error) {
    let message: string
    if (error instanceof LoginRequiredError) {
      message =
        'The DevNotes MCP server is not signed in to Google. Ask the user to run `devnotes-mcp login` (node packages/mcp/dist/index.js login) in a terminal, then retry.'
    } else if (error instanceof UserError) {
      message = error.message
    } else if (error instanceof GoogleError) {
      message = `Google Sheets error ${String(error.status)}: ${error.message}`
    } else {
      message = error instanceof Error ? error.message : String(error)
    }
    return { ...json({ error: message }), isError: true }
  }
}

const projectIdField = z
  .string()
  .min(1)
  .describe('Project id from list_projects. Use "none" for notes outside any project.')

export function registerTools(server: McpServer, store: StoreSource): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List DevNotes projects',
      description:
        "Lists the projects in the user's DevNotes (a notes app for game and software developers, stored in Google Sheets). " +
        'Call this first to get the project id needed by list_notes and create_notes. ' +
        'Returns id, name and role (owner, or member of a project shared by someone else). ' +
        'The entry with id "none" ("Без проекта") holds notes that belong to no project.',
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    () => answer(async () => ({ projects: await (await store()).listProjects() })),
  )

  server.registerTool(
    'list_notes',
    {
      title: 'List notes of a project',
      description:
        'Lists notes (ideas, bugs, fixes) of one DevNotes project, newest first, without archived or deleted ones. ' +
        'Each note has id, title, status (new, wip = in progress, done), labels (for example "Баг" = bug, "Идея" = idea, "Фикс" = fix), ' +
        "a short excerpt of the text, whether a solution is recorded, and whether it still waits for the user's review. " +
        'Optional filters: status, label (case-insensitive), query (searches title, text and solution), limit. ' +
        'Use get_note to read a note in full. Check existing notes before creating new ones to avoid duplicates.',
      inputSchema: {
        projectId: projectIdField,
        status: z.enum(NOTE_STATUSES).optional().describe('Only notes with this status.'),
        label: z.string().min(1).optional().describe('Only notes with this label, e.g. "Баг".'),
        query: z
          .string()
          .optional()
          .describe('Text to look for in title, text and solution, case-insensitive.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .optional()
          .describe(`How many notes to return; default ${String(DEFAULT_LIST_LIMIT)}.`),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ projectId, status, label, query, limit }) =>
      answer(async () => {
        const notes = await (await store()).listNotes(projectId, { status, label, query, limit })
        return { count: notes.length, notes: notes.map(compact) }
      }),
  )

  server.registerTool(
    'get_note',
    {
      title: 'Read a note',
      description:
        'Returns one DevNotes note in full: title, text, status, labels, the solution ("how I fixed it") and timestamps. ' +
        'Pass projectId when you know it; without it every project is searched.',
      inputSchema: {
        noteId: z.string().min(1).describe('Note id from list_notes.'),
        projectId: projectIdField.optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ noteId, projectId }) =>
      answer(async () => ({ note: full(await (await store()).getNote(noteId, projectId)) })),
  )

  server.registerTool(
    'create_notes',
    {
      title: 'Create note cards for review',
      description:
        `Creates up to ${String(MAX_CREATE)} note cards in a DevNotes project, for example bugs found in the code or ideas. ` +
        'The cards do NOT appear among the user\'s notes right away: they always go to "На проверку" (review) on the DevNotes website, ' +
        'where the user accepts or deletes them. Tell the user this after creating cards. ' +
        'Only "title" is required (up to 200 characters). "body" is plain text without Markdown; for a bug write three lines: ' +
        '"Что случилось: …", "Как повторить: …", "Ожидалось: …" (what happened, how to reproduce, what was expected). ' +
        'Write titles and text in the language the user writes in. ' +
        '"labels" are label names: "Баг" for a bug, "Идея" for an idea, "Фикс" for a fix, or the user\'s own; labels that do not exist yet are created, at most 10 per call. ' +
        '"status" is new (default), wip or done. "solution" describes how a bug was fixed. ' +
        'Call list_notes first to avoid duplicates.',
      inputSchema: {
        projectId: projectIdField,
        notes: z
          .array(
            z.object({
              title: z.string().min(1).describe('Short title, up to 200 characters.'),
              body: z.string().optional().describe('Details as plain text.'),
              labels: z.array(z.string()).optional().describe('Label names, e.g. ["Баг"].'),
              status: z.enum(NOTE_STATUSES).optional().describe('new (default), wip or done.'),
              solution: z.string().optional().describe('How the bug was fixed, if it was.'),
            }),
          )
          .min(1)
          .max(MAX_CREATE),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    ({ projectId, notes }) =>
      answer(async () => {
        const result = await (await store()).createNotes(projectId, notes)
        return {
          created: result.notes.map((note) => ({ id: note.id, title: note.title })),
          note: 'The cards are waiting in "На проверку" (review) on the DevNotes website until the user accepts them.',
          ...(result.newLabels.length > 0 ? { newLabels: result.newLabels } : {}),
          ...(result.droppedLabels.length > 0
            ? {
                droppedLabels: result.droppedLabels,
                droppedReason: 'At most 10 new labels per call.',
              }
            : {}),
          ...(result.skipped > 0 ? { skippedWithoutTitle: result.skipped } : {}),
        }
      }),
  )

  server.registerTool(
    'update_note',
    {
      title: 'Update status, labels or solution',
      description:
        'Changes the status, the labels or the solution ("how I fixed it") of an existing DevNotes note, for example to mark a bug as done after fixing it. ' +
        'The title and the text are never changed by this tool. ' +
        '"labels" replaces the whole list of labels. A non-empty solution also adds the "Фикс" label. ' +
        'Pass projectId when you know it; without it every project is searched.',
      inputSchema: {
        noteId: z.string().min(1).describe('Note id from list_notes.'),
        projectId: projectIdField.optional(),
        status: z.enum(NOTE_STATUSES).optional().describe('new, wip (in progress) or done.'),
        labels: z.array(z.string()).optional().describe('The new full list of label names.'),
        solution: z.string().optional().describe('How the bug was fixed.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ noteId, projectId, status, labels, solution }) =>
      answer(async () => {
        const result = await (
          await store()
        ).updateNote(noteId, { status, labels, solution }, projectId)
        return {
          note: full(result.note),
          ...(result.droppedLabels.length > 0
            ? {
                droppedLabels: result.droppedLabels,
                droppedReason: 'At most 10 new labels per call.',
              }
            : {}),
        }
      }),
  )
}
