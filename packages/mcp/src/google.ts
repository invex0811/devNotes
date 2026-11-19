import { APP_PROPERTY_KEY, rangeRows, type Cell, type SheetName } from '@devnotes/core'

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet'

export interface ValueRange {
  range: string
  values: Cell[][]
}

/** The part of Google Sheets and Drive the MCP server uses. Tests replace it with a fake. */
export interface SheetsClient {
  /** The signed-in account's e-mail, from Drive `about.get`. */
  getEmail(): Promise<string>
  /** The user's home spreadsheet, found by its `appProperties` mark. */
  findHomeSpreadsheet(): Promise<string | null>
  /** `values.batchGet`, unformatted values; aligned with `ranges`. */
  getValues(spreadsheetId: string, ranges: readonly string[]): Promise<Cell[][][]>
  /** `values.append` with RAW input; returns the rows the data landed in. */
  appendRows(
    spreadsheetId: string,
    sheet: SheetName,
    rows: Cell[][],
  ): Promise<{ first: number; last: number }>
  /** `values.batchUpdate` with RAW input. */
  writeRanges(spreadsheetId: string, data: readonly ValueRange[]): Promise<void>
}

/** Google answered with an error. */
export class GoogleError extends Error {
  override name = 'GoogleError'
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function createSheetsClient(
  getToken: () => Promise<string>,
  fetchImpl: typeof fetch = fetch,
): SheetsClient {
  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (!response.ok) {
      let message = `HTTP ${String(response.status)}`
      try {
        const body = (await response.json()) as { error?: { message?: string } }
        message = body.error?.message ?? message
      } catch {
        // Not JSON: keep the status.
      }
      throw new GoogleError(response.status, message)
    }
    return (await response.json()) as T
  }

  const query = (params: Record<string, string>) => new URLSearchParams(params).toString()

  return {
    async getEmail() {
      const about = await call<{ user?: { emailAddress?: string } }>(
        `${DRIVE}/about?fields=user(emailAddress)`,
      )
      return about.user?.emailAddress ?? ''
    },

    async findHomeSpreadsheet() {
      const result = await call<{ files?: { id: string }[] }>(
        `${DRIVE}/files?${query({
          q: [
            `appProperties has { key='${APP_PROPERTY_KEY}' and value='home' }`,
            `mimeType='${SPREADSHEET_MIME}'`,
            'trashed=false',
          ].join(' and '),
          spaces: 'drive',
          orderBy: 'createdTime',
          pageSize: '10',
          fields: 'files(id)',
        })}`,
      )
      return result.files?.[0]?.id ?? null
    },

    async getValues(spreadsheetId, ranges) {
      const params = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE' })
      for (const range of ranges) params.append('ranges', range)
      const result = await call<{ valueRanges?: { values?: Cell[][] }[] }>(
        `${SHEETS}/${spreadsheetId}/values:batchGet?${params.toString()}`,
      )
      return ranges.map((_, index) => result.valueRanges?.[index]?.values ?? [])
    },

    async appendRows(spreadsheetId, sheet, rows) {
      const params = query({ valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' })
      const result = await call<{ updates?: { updatedRange?: string } }>(
        `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(`${sheet}!A1`)}:append?${params}`,
        { method: 'POST', body: JSON.stringify({ majorDimension: 'ROWS', values: rows }) },
      )
      const range = rangeRows(result.updates?.updatedRange ?? '')
      if (!range) throw new GoogleError(200, 'values.append returned no updatedRange')
      return range
    },

    async writeRanges(spreadsheetId, data) {
      if (data.length === 0) return
      await call(`${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: data.map((range) => ({ ...range, majorDimension: 'ROWS' })),
        }),
      })
    },
  }
}
