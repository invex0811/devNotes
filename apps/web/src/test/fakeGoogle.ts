import {
  SHEET_COLUMNS,
  metaRows,
  readHeader,
  sheetsOf,
  type Cell,
  type SheetName,
  type SpreadsheetKind,
} from '@devnotes/core'
import {
  GoogleHttpError,
  type GoogleAccount,
  type GoogleApi,
  type ValueRange,
} from '../data/google/api'

export type FakeMethod = keyof GoogleApi

interface FakeSpreadsheet {
  kind: SpreadsheetKind
  title: string
  sheets: Map<string, Cell[][]>
  /** `root` (the root of My Drive), a folder id, or anything else the user picked. */
  parent: string
  owner: 'me' | 'other'
  /** Private `appProperties`. */
  properties: Record<string, string>
}

function columnIndex(letters: string): number {
  let n = 0
  for (const char of letters.toUpperCase()) n = n * 26 + (char.charCodeAt(0) - 64)
  return n - 1
}

interface Area {
  sheet: string
  /** Zero-based, inclusive; undefined means "to the end". */
  top: number
  left: number
  bottom?: number
  right?: number
}

function parseRange(range: string): Area {
  const [sheet = '', cells] = range.includes('!') ? range.split('!') : [range, undefined]
  if (cells === undefined) return { sheet, top: 0, left: 0 }
  const rows = /^(\d+):(\d+)$/.exec(cells)
  if (rows) return { sheet, top: Number(rows[1]) - 1, bottom: Number(rows[2]) - 1, left: 0 }
  const cols = /^([A-Z]+):([A-Z]+)$/.exec(cells)
  if (cols?.[1] && cols[2]) {
    return { sheet, top: 0, left: columnIndex(cols[1]), right: columnIndex(cols[2]) }
  }
  const box = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(cells)
  if (!box?.[1]) throw new Error(`Fake Sheets cannot parse range ${range}`)
  const top = Number(box[2]) - 1
  const left = columnIndex(box[1])
  return box[3]
    ? { sheet, top, left, bottom: Number(box[4]) - 1, right: columnIndex(box[3]) }
    : { sheet, top, left }
}

/** Drops trailing empty cells and rows, as the Sheets API does. */
function trim(rows: Cell[][]): Cell[][] {
  const result = rows.map((row) => {
    const copy = [...row]
    while (copy.length > 0 && (copy.at(-1) === '' || copy.at(-1) === undefined)) copy.pop()
    return copy
  })
  while (result.length > 0 && result.at(-1)?.length === 0) result.pop()
  return result
}

/**
 * Google Sheets and Drive in memory, with real cells and A1 ranges, so the sync
 * code is tested against the same row arithmetic the real API does.
 */
export class FakeGoogle implements GoogleApi {
  account: GoogleAccount = {
    id: 'user-1',
    name: 'Игорь',
    email: 'user@example.com',
    photoUrl: null,
  }
  readonly spreadsheets = new Map<string, FakeSpreadsheet>()
  readonly calls: FakeMethod[] = []
  /** Emails each spreadsheet was shared with. */
  readonly permissions = new Map<string, string[]>()
  /** Spreadsheets that were deleted or closed: reading them answers 404. */
  readonly gone = new Set<string>()
  /** DevNotes folders (`devnotes=folder`) in the root of My Drive. */
  readonly folders = new Map<string, { trashed: boolean }>()
  /** Return an error to make the next call of that method fail. */
  fail: ((method: FakeMethod) => Error | null) | null = null
  private nextId = 0

  private check(method: FakeMethod) {
    this.calls.push(method)
    const error = this.fail?.(method)
    if (error) throw error
  }

  count(method: FakeMethod): number {
    return this.calls.filter((call) => call === method).length
  }

  sheet(spreadsheetId: string, sheet: SheetName): Cell[][] {
    const rows = this.spreadsheets.get(spreadsheetId)?.sheets.get(sheet)
    if (!rows) throw new Error(`No sheet ${sheet} in ${spreadsheetId}`)
    return rows
  }

  /** Rows of a sheet as objects keyed by the header, for readable assertions. */
  records(spreadsheetId: string, sheet: SheetName): Record<string, Cell>[] {
    const [headerRow, ...rows] = this.sheet(spreadsheetId, sheet)
    const header = readHeader(headerRow)
    return rows.map((row) =>
      Object.fromEntries([...header].map(([name, index]) => [name, row[index] ?? ''])),
    )
  }

  getAccount() {
    this.check('getAccount')
    return Promise.resolve({ ...this.account })
  }

  findSpreadsheet(kind: SpreadsheetKind) {
    this.check('findSpreadsheet')
    // Found by its mark wherever it lies, as Drive's files.list does.
    const found = [...this.spreadsheets].find(
      ([, sheet]) => sheet.kind === kind && sheet.owner === 'me',
    )
    return Promise.resolve(found ? { id: found[0], properties: { ...found[1].properties } } : null)
  }

  /** In tests `folderId` may be left out: the spreadsheet then lies in the root. */
  createSpreadsheet(
    kind: SpreadsheetKind,
    title: string,
    name: string,
    folderId: string | null = null,
    properties: Readonly<Record<string, string>> = {},
  ) {
    this.check('createSpreadsheet')
    return Promise.resolve(
      this.addSpreadsheet(kind, title, name, {
        parent: folderId ?? 'root',
        owner: 'me',
        properties,
      }),
    )
  }

  /** A project spreadsheet of another person, shared with the user (not in their root). */
  addForeignProject(title: string, name: string): string {
    return this.addSpreadsheet('project', title, name, {
      parent: 'shared-with-me',
      owner: 'other',
      properties: {},
    })
  }

  private addSpreadsheet(
    kind: SpreadsheetKind,
    title: string,
    name: string,
    file: Pick<FakeSpreadsheet, 'parent' | 'owner' | 'properties'>,
  ): string {
    this.nextId += 1
    const id = `${kind}-${String(this.nextId)}`
    const sheets = new Map<string, Cell[][]>()
    for (const sheet of sheetsOf(kind)) {
      const rows: Cell[][] = [[...SHEET_COLUMNS[sheet]]]
      if (sheet === 'meta') rows.push(...metaRows(kind, name))
      sheets.set(sheet, rows)
    }
    this.spreadsheets.set(id, {
      kind,
      title,
      sheets,
      parent: file.parent,
      owner: file.owner,
      properties: { ...file.properties, devnotes: kind },
    })
    return id
  }

  findFolder() {
    this.check('findFolder')
    const found = [...this.folders].find(([, folder]) => !folder.trashed)
    return Promise.resolve(found?.[0] ?? null)
  }

  createFolder() {
    this.check('createFolder')
    this.nextId += 1
    const id = `folder-${String(this.nextId)}`
    this.folders.set(id, { trashed: false })
    return Promise.resolve(id)
  }

  listRootSpreadsheets() {
    this.check('listRootSpreadsheets')
    return Promise.resolve(
      [...this.spreadsheets]
        .filter(([, sheet]) => sheet.parent === 'root' && sheet.owner === 'me')
        .map(([id]) => id),
    )
  }

  moveToFolder(fileId: string, folderId: string) {
    this.check('moveToFolder')
    const sheet = this.spreadsheets.get(fileId)
    if (sheet?.parent !== 'root') {
      return Promise.reject(new GoogleHttpError(400, 'The file is not in the root folder.'))
    }
    sheet.parent = folderId
    return Promise.resolve()
  }

  setFileProperties(fileId: string, properties: Readonly<Record<string, string>>) {
    this.check('setFileProperties')
    const sheet = this.spreadsheets.get(fileId)
    if (sheet) sheet.properties = { ...sheet.properties, ...properties }
    return Promise.resolve()
  }

  getValues(spreadsheetId: string, ranges: readonly string[]) {
    this.check('getValues')
    if (this.gone.has(spreadsheetId)) {
      return Promise.reject(new GoogleHttpError(404, 'Requested entity was not found.'))
    }
    return Promise.resolve(
      ranges.map((range) => {
        const area = parseRange(range)
        const rows = this.sheet(spreadsheetId, area.sheet as SheetName)
        const bottom = area.bottom ?? rows.length - 1
        const picked: Cell[][] = []
        for (let r = area.top; r <= bottom && r < rows.length; r++) {
          const row = rows[r] ?? []
          const right = area.right ?? row.length - 1
          picked.push(row.slice(area.left, right + 1))
        }
        return trim(picked)
      }),
    )
  }

  appendRows(spreadsheetId: string, sheet: SheetName, rows: Cell[][]) {
    this.check('appendRows')
    const target = this.sheet(spreadsheetId, sheet)
    const used = trim(target).length
    target.length = used
    target.push(...rows.map((row) => [...row]))
    return Promise.resolve({ first: used + 1, last: used + rows.length })
  }

  writeRanges(spreadsheetId: string, data: readonly ValueRange[]) {
    this.check('writeRanges')
    for (const range of data) {
      const area = parseRange(range.range)
      const target = this.sheet(spreadsheetId, area.sheet as SheetName)
      range.values.forEach((values, offset) => {
        const r = area.top + offset
        while (target.length <= r) target.push([])
        const row = target[r] ?? []
        values.forEach((value, c) => (row[area.left + c] = value))
        target[r] = row
      })
    }
    return Promise.resolve()
  }

  listProjectFiles() {
    this.check('listProjectFiles')
    const files = new Map<string, { shared: boolean }>()
    for (const [id, sheet] of this.spreadsheets) {
      if (sheet.kind === 'project' && !this.gone.has(id)) {
        files.set(id, { shared: (this.permissions.get(id) ?? []).length > 0 })
      }
    }
    return Promise.resolve(files)
  }

  shareSpreadsheet(spreadsheetId: string, email: string) {
    this.check('shareSpreadsheet')
    this.permissions.set(spreadsheetId, [...(this.permissions.get(spreadsheetId) ?? []), email])
    return Promise.resolve()
  }

  renameSpreadsheet(spreadsheetId: string, title: string) {
    this.check('renameSpreadsheet')
    const sheet = this.spreadsheets.get(spreadsheetId)
    if (sheet) sheet.title = title
    return Promise.resolve()
  }

  clearRanges(spreadsheetId: string, ranges: readonly string[]) {
    this.check('clearRanges')
    for (const range of ranges) {
      const area = parseRange(range)
      const target = this.sheet(spreadsheetId, area.sheet as SheetName)
      for (let r = area.top; r <= (area.bottom ?? area.top); r++) {
        const row = target[r]
        if (!row) continue
        for (let c = area.left; c <= (area.right ?? row.length - 1); c++) row[c] = ''
      }
    }
    return Promise.resolve()
  }
}
