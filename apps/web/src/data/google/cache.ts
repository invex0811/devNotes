import type { CustomLabel, Note, Project, RowRecord, SheetName } from '@devnotes/core'
import { Dexie, type EntityTable } from 'dexie'
import type { GoogleAccount } from './api'

/** A custom label as cached, remembering which spreadsheet it came from. */
export interface CachedLabel extends CustomLabel {
  /** `${spreadsheetId}|${labelKey(name)}` */
  key: string
  spreadsheetId: string
}

/**
 * One pending write. Ops are logical ("put this row", "clear that row"): the row
 * number is looked up only when the queue is sent, since the sheet can change.
 */
export interface QueuedOp {
  seq?: number
  spreadsheetId: string
  sheet: SheetName
  /** Identifies the row to write: note or project id, label key of the current name. */
  key: string
  /** The values to write; `null` clears the row (deleted labels). */
  record: RowRecord | null
  /** Ops with the same coalesce key replace each other: only the last one is sent. */
  coalesce: string | null
}

interface KeyValue {
  key: string
  value: unknown
}

export const CACHE_DB_NAME = 'devnotes'

/** Local cache of the user's data and the write queue, in IndexedDB. */
export class CacheDb extends Dexie {
  notes!: EntityTable<Note, 'id'>
  labels!: EntityTable<CachedLabel, 'key'>
  projects!: EntityTable<Project, 'id'>
  queue!: EntityTable<QueuedOp, 'seq'>
  kv!: EntityTable<KeyValue, 'key'>

  constructor(name = CACHE_DB_NAME) {
    super(name)
    this.version(1).stores({
      notes: 'id',
      labels: 'key, spreadsheetId',
      projects: 'id',
      queue: '++seq, coalesce, spreadsheetId',
      kv: 'key',
    })
  }

  async getValue<T>(key: string): Promise<T | undefined> {
    const row = await this.kv.get(key)
    return row?.value as T | undefined
  }

  async setValue(key: string, value: unknown): Promise<void> {
    await this.kv.put({ key, value })
  }
}

export const KV = {
  account: 'account',
  homeSpreadsheetId: 'homeSpreadsheetId',
} as const

export interface CachedSession {
  account: GoogleAccount
  homeSpreadsheetId: string
}

export async function readCachedSession(db: CacheDb): Promise<CachedSession | null> {
  const [account, homeSpreadsheetId] = await Promise.all([
    db.getValue<GoogleAccount>(KV.account),
    db.getValue<string>(KV.homeSpreadsheetId),
  ])
  return account && homeSpreadsheetId ? { account, homeSpreadsheetId } : null
}
