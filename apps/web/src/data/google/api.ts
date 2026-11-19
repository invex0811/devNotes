import {
  APP_PROPERTY_KEY,
  SHEET_COLUMNS,
  metaRows,
  rangeRows,
  sheetsOf,
  type Cell,
  type SheetName,
  type SpreadsheetKind,
} from '@devnotes/core'

/** The signed-in Google account, as Drive `about.get` returns it under `drive.file`. */
export interface GoogleAccount {
  /** Drive permission id: stable per account. */
  id: string
  name: string
  email: string
  photoUrl: string | null
}

export interface ValueRange {
  range: string
  values: Cell[][]
}

/**
 * Everything the app asks from Google Sheets and Drive. The HTTP implementation
 * is below; tests use an in-memory fake with the same shape.
 */
export interface GoogleApi {
  getAccount(): Promise<GoogleAccount>
  /** Finds the user's spreadsheet of this kind by its Drive `appProperties` mark. */
  findSpreadsheet(kind: SpreadsheetKind): Promise<string | null>
  /** Creates a spreadsheet with all sheets and header rows and marks it in Drive. */
  createSpreadsheet(kind: SpreadsheetKind, title: string, name: string): Promise<string>
  /** `values.batchGet`; the result is aligned with `ranges`. */
  getValues(spreadsheetId: string, ranges: readonly string[]): Promise<Cell[][][]>
  /** `values.append` of new rows to a sheet; returns the rows they landed in. */
  appendRows(
    spreadsheetId: string,
    sheet: SheetName,
    rows: Cell[][],
  ): Promise<{ first: number; last: number }>
  /** `values.batchUpdate` with `valueInputOption=RAW`. */
  writeRanges(spreadsheetId: string, data: readonly ValueRange[]): Promise<void>
  /** `values.batchClear`. */
  clearRanges(spreadsheetId: string, ranges: readonly string[]): Promise<void>
  /**
   * Project spreadsheets the app can see, with Drive's `shared` flag: one
   * `files.list` instead of a request per project.
   */
  listProjectFiles(): Promise<Map<string, { shared: boolean }>>
  /** Drive `permissions.create`: role `writer` for a Google account; Google emails them. */
  shareSpreadsheet(spreadsheetId: string, email: string): Promise<void>
  /** Renames the spreadsheet file in Drive. */
  renameSpreadsheet(spreadsheetId: string, title: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Errors

/** No token, or Google answered 401: the user has to renew the session. */
export class AuthError extends Error {
  override name = 'AuthError'
}

/** No network, 429 or a server error: worth retrying later. */
export class TransientError extends Error {
  override name = 'TransientError'
}

/** Any other answer from Google (403, 404, 400…). Retrying will not help. */
export class GoogleHttpError extends Error {
  override name = 'GoogleHttpError'
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// HTTP implementation

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet'

/** Drive answers rate limits with 403 and one of these reasons. */
const RATE_LIMIT_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded'])

interface GoogleErrorBody {
  error?: { message?: string; errors?: { reason?: string }[] }
}

async function failure(response: Response): Promise<Error> {
  let body: GoogleErrorBody = {}
  try {
    body = (await response.json()) as GoogleErrorBody
  } catch {
    // Not JSON: keep the status only.
  }
  const message = body.error?.message ?? `HTTP ${String(response.status)}`
  const reasons = body.error?.errors?.map((error) => error.reason) ?? []
  if (response.status === 401) return new AuthError(message)
  if (response.status === 429 || response.status >= 500) return new TransientError(message)
  if (response.status === 403 && reasons.some((r) => r && RATE_LIMIT_REASONS.has(r))) {
    return new TransientError(message)
  }
  return new GoogleHttpError(response.status, message)
}

export function createHttpApi(getToken: () => string | null): GoogleApi {
  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = getToken()
    if (!token) throw new AuthError('No access token')
    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      })
    } catch (error) {
      // fetch rejects only when the request never got an answer.
      throw new TransientError(error instanceof Error ? error.message : 'Network error')
    }
    if (!response.ok) throw await failure(response)
    return (await response.json()) as T
  }

  const post = <T>(url: string, body: unknown) =>
    call<T>(url, { method: 'POST', body: JSON.stringify(body) })

  const query = (params: Record<string, string>) => new URLSearchParams(params).toString()

  return {
    async getAccount() {
      const about = await call<{
        user: {
          permissionId: string
          displayName?: string
          emailAddress?: string
          photoLink?: string
        }
      }>(`${DRIVE}/about?fields=user(permissionId,displayName,emailAddress,photoLink)`)
      return {
        id: about.user.permissionId,
        name: about.user.displayName ?? '',
        email: about.user.emailAddress ?? '',
        photoUrl: about.user.photoLink ?? null,
      }
    },

    async findSpreadsheet(kind) {
      const result = await call<{ files?: { id: string }[] }>(
        `${DRIVE}/files?${query({
          q: filesOfKind(kind),
          spaces: 'drive',
          orderBy: 'createdTime',
          pageSize: '10',
          fields: 'files(id)',
        })}`,
      )
      return result.files?.[0]?.id ?? null
    },

    async listProjectFiles() {
      const files = new Map<string, { shared: boolean }>()
      let pageToken: string | undefined
      do {
        const result = await call<{
          files?: { id: string; shared?: boolean }[]
          nextPageToken?: string
        }>(
          `${DRIVE}/files?${query({
            q: filesOfKind('project'),
            spaces: 'drive',
            pageSize: '1000',
            fields: 'nextPageToken,files(id,shared)',
            ...(pageToken ? { pageToken } : {}),
          })}`,
        )
        for (const file of result.files ?? []) files.set(file.id, { shared: file.shared ?? false })
        pageToken = result.nextPageToken
      } while (pageToken)
      return files
    },

    async shareSpreadsheet(spreadsheetId, email) {
      await post(
        `${DRIVE}/files/${spreadsheetId}/permissions?${query({
          sendNotificationEmail: 'true',
          fields: 'id',
        })}`,
        { type: 'user', role: 'writer', emailAddress: email },
      )
    },

    async renameSpreadsheet(spreadsheetId, title) {
      await call(`${DRIVE}/files/${spreadsheetId}?fields=id`, {
        method: 'PATCH',
        body: JSON.stringify({ name: title }),
      })
    },

    async createSpreadsheet(kind, title, name) {
      const sheets = sheetsOf(kind).map((sheet) => {
        const rows: Cell[][] = [[...SHEET_COLUMNS[sheet]]]
        if (sheet === 'meta') rows.push(...metaRows(kind, name))
        return {
          properties: { title: sheet, gridProperties: { frozenRowCount: 1 } },
          data: [{ startRow: 0, startColumn: 0, rowData: rows.map(toRowData) }],
        }
      })
      const created = await post<{ spreadsheetId: string }>(SHEETS, {
        properties: { title },
        sheets,
      })
      // Sheets cannot set appProperties, so the mark is added through Drive.
      await call(`${DRIVE}/files/${created.spreadsheetId}?fields=id`, {
        method: 'PATCH',
        body: JSON.stringify({ appProperties: { [APP_PROPERTY_KEY]: kind } }),
      })
      return created.spreadsheetId
    },

    async getValues(spreadsheetId, ranges) {
      const params = new URLSearchParams({
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      })
      for (const range of ranges) params.append('ranges', range)
      const result = await call<{ valueRanges?: { values?: Cell[][] }[] }>(
        `${SHEETS}/${spreadsheetId}/values:batchGet?${params.toString()}`,
      )
      return ranges.map((_, index) => result.valueRanges?.[index]?.values ?? [])
    },

    async appendRows(spreadsheetId, sheet, rows) {
      const params = query({
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        includeValuesInResponse: 'false',
      })
      const result = await post<{ updates?: { updatedRange?: string } }>(
        `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(`${sheet}!A1`)}:append?${params}`,
        { majorDimension: 'ROWS', values: rows },
      )
      const range = rangeRows(result.updates?.updatedRange ?? '')
      if (!range) throw new GoogleHttpError(200, 'values.append returned no updatedRange')
      return range
    },

    async writeRanges(spreadsheetId, data) {
      if (data.length === 0) return
      await post(`${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
        valueInputOption: 'RAW',
        data: data.map((range) => ({ ...range, majorDimension: 'ROWS' })),
      })
    },

    async clearRanges(spreadsheetId, ranges) {
      if (ranges.length === 0) return
      await post(`${SHEETS}/${spreadsheetId}/values:batchClear`, { ranges })
    },
  }
}

function filesOfKind(kind: SpreadsheetKind): string {
  return [
    `appProperties has { key='${APP_PROPERTY_KEY}' and value='${kind}' }`,
    `mimeType='${SPREADSHEET_MIME}'`,
    'trashed=false',
  ].join(' and ')
}

function toRowData(row: readonly Cell[]) {
  return {
    values: row.map((cell) =>
      typeof cell === 'number'
        ? { userEnteredValue: { numberValue: cell } }
        : typeof cell === 'boolean'
          ? { userEnteredValue: { boolValue: cell } }
          : { userEnteredValue: { stringValue: cell } },
    ),
  }
}
