/** Version of the spreadsheet layout, stored in the `meta` sheet as `schema_version`. */
export const SCHEMA_VERSION = 1

/** Note statuses exactly as they are written to the `status` column. */
export const NOTE_STATUSES = ['new', 'wip', 'done'] as const

export type NoteStatus = (typeof NOTE_STATUSES)[number]
