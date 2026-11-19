import {
  SHEET_COLUMNS,
  metaRows,
  readHeader,
  sheetsOf,
  type Cell,
  type SheetName,
  type SpreadsheetKind,
} from '@devnotes/core'
import { GoogleError, type SheetsClient, type ValueRange } from './google'

/** Test double for Google Sheets: real cells, the few A1 ranges the server uses. */
export class FakeSheets implements SheetsClient {
  readonly spreadsheets = new Map<string, Map<string, Cell[][]>>()
  home: string | null = null
  /** Every range written with writeRanges, in order. */
  readonly written: string[] = []
  private nextId = 0

  create(kind: SpreadsheetKind, name: string): string {
    this.nextId += 1
    const id = `${kind}-${String(this.nextId)}`
    const sheets = new Map<string, Cell[][]>()
    for (const sheet of sheetsOf(kind)) {
      const rows: Cell[][] = [[...SHEET_COLUMNS[sheet]]]
      if (sheet === 'meta') rows.push(...metaRows(kind, name))
      sheets.set(sheet, rows)
    }
    this.spreadsheets.set(id, sheets)
    if (kind === 'home') this.home ??= id
    return id
  }

  sheet(id: string, name: SheetName): Cell[][] {
    const rows = this.spreadsheets.get(id)?.get(name)
    if (!rows) throw new GoogleError(404, `No sheet ${name} in ${id}`)
    return rows
  }

  /** Rows as objects keyed by the header, for readable assertions. */
  records(id: string, name: SheetName): Record<string, Cell>[] {
    const [headerRow, ...rows] = this.sheet(id, name)
    const header = readHeader(headerRow)
    return rows.map((row) =>
      Object.fromEntries([...header].map(([column, index]) => [column, row[index] ?? ''])),
    )
  }

  getEmail() {
    return Promise.resolve('user@example.com')
  }

  findHomeSpreadsheet() {
    return Promise.resolve(this.home)
  }

  getValues(id: string, ranges: readonly string[]) {
    return Promise.resolve(
      ranges.map((range) => {
        const [name = '', cells] = range.split('!')
        const rows = this.sheet(id, name as SheetName)
        if (cells === '1:1') return rows.slice(0, 1).map((row) => [...row])
        return rows.map((row) => [...row])
      }),
    )
  }

  appendRows(id: string, name: SheetName, rows: Cell[][]) {
    const target = this.sheet(id, name)
    const first = target.length + 1
    target.push(...rows.map((row) => [...row]))
    return Promise.resolve({ first, last: target.length })
  }

  writeRanges(id: string, data: readonly ValueRange[]) {
    for (const { range, values } of data) {
      this.written.push(range)
      const match = /^(\w+)!([A-Z]+)(\d+)/.exec(range)
      if (!match?.[1] || !match[2] || !match[3]) throw new Error(`Bad range ${range}`)
      const target = this.sheet(id, match[1] as SheetName)
      const column = match[2].charCodeAt(0) - 65
      const row = target[Number(match[3]) - 1] ?? []
      values[0]?.forEach((value, offset) => (row[column + offset] = value))
      target[Number(match[3]) - 1] = row
    }
    return Promise.resolve()
  }
}
