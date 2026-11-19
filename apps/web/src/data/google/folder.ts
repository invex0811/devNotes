import { FOLDER_MOVED_KEY } from '@devnotes/core'
import type { DriveFile, GoogleApi } from './api'

/**
 * The DevNotes folder for a new spreadsheet. A deleted or trashed folder is not
 * found, so a new one is created then.
 */
export async function ensureFolder(api: GoogleApi): Promise<string> {
  return (await api.findFolder()) ?? (await api.createFolder())
}

/**
 * Moves the user's own spreadsheets that were created in the root of My Drive
 * into the folder, once: the home spreadsheet remembers that it was done, so a
 * spreadsheet the user moves somewhere later is left where it is. Shared
 * projects of other people are never in the user's root and are not touched.
 */
export async function moveOldSpreadsheets(api: GoogleApi, home: DriveFile): Promise<void> {
  if (home.properties[FOLDER_MOVED_KEY] === 'true') return
  const ids = await api.listRootSpreadsheets()
  if (ids.length > 0) {
    const folder = await ensureFolder(api)
    for (const id of ids) await api.moveToFolder(id, folder)
  }
  await api.setFileProperties(home.id, { [FOLDER_MOVED_KEY]: 'true' })
}
