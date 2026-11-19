/**
 * Google Identity Services, token model: the browser gets a short-lived access
 * token in a Google popup. The token lives only in memory, never in storage.
 * https://developers.google.com/identity/oauth2/web/guides/use-token-model
 */

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
/** Treat the token as expired a minute early, so a request never races its expiry. */
const EXPIRY_MARGIN_MS = 60_000

// The small part of the GIS library the app uses.
interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  scope?: string
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken(override?: { prompt?: string; login_hint?: string }): void
}
interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }): TokenClient
  hasGrantedAllScopes(response: TokenResponse, scope: string): boolean
  revoke(token: string, done?: () => void): void
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

/** Why a token request ended without a token. */
export type TokenFailure =
  /** The user closed the popup before signing in. */
  | 'popup'
  /** The browser did not let the popup open. */
  | 'popupBlocked'
  /** The user did not tick access to files on the consent screen. */
  | 'scope'
  | 'denied'

export class TokenRequestError extends Error {
  override name = 'TokenRequestError'
  readonly reason: TokenFailure
  constructor(reason: TokenFailure) {
    super(reason)
    this.reason = reason
  }
}

export interface TokenSource {
  /** Resolves when the GIS library has loaded and a token can be requested. */
  ready(): Promise<void>
  /** The current token, or null when there is none or it has expired. */
  getToken(): string | null
  /**
   * Opens the Google popup. Must be called right from a click, otherwise the
   * browser blocks the popup.
   */
  request(options: { prompt: '' | 'select_account'; loginHint?: string }): Promise<void>
  /** Revokes the token at Google and forgets it. */
  revoke(): Promise<void>
}

let scriptLoading: Promise<GoogleOAuth2> | null = null

function loadGis(): Promise<GoogleOAuth2> {
  scriptLoading ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const done = () => {
      const oauth2 = window.google?.accounts?.oauth2
      if (oauth2) resolve(oauth2)
      else reject(new Error('Google Identity Services did not load'))
    }
    if (window.google?.accounts?.oauth2) {
      done()
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SCRIPT
    script.async = true
    script.onload = done
    script.onerror = () => {
      scriptLoading = null
      reject(new Error('Google Identity Services did not load'))
    }
    document.head.append(script)
  })
  return scriptLoading
}

export function createGisTokenSource(clientId: string): TokenSource {
  let oauth2: GoogleOAuth2 | null = null
  let client: TokenClient | null = null
  let token: { value: string; expiresAt: number } | null = null
  let pending: { resolve: () => void; reject: (error: Error) => void } | null = null

  const settle = (error: Error | null) => {
    const current = pending
    pending = null
    if (!current) return
    if (error) current.reject(error)
    else current.resolve()
  }

  const loading = loadGis().then((library) => {
    oauth2 = library
    client = library.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          settle(new TokenRequestError('denied'))
          return
        }
        if (!library.hasGrantedAllScopes(response, DRIVE_FILE_SCOPE)) {
          settle(new TokenRequestError('scope'))
          return
        }
        const seconds = Number(response.expires_in ?? 3600)
        token = {
          value: response.access_token,
          expiresAt: Date.now() + seconds * 1000 - EXPIRY_MARGIN_MS,
        }
        settle(null)
      },
      error_callback: (error) => {
        settle(
          new TokenRequestError(error.type === 'popup_failed_to_open' ? 'popupBlocked' : 'popup'),
        )
      },
    })
  })

  return {
    ready: () => loading,

    getToken() {
      if (!token || Date.now() >= token.expiresAt) return null
      return token.value
    },

    request({ prompt, loginHint }) {
      if (!client) return Promise.reject(new Error('Google Identity Services is not ready'))
      // A new request replaces one the user abandoned without closing the popup.
      settle(new TokenRequestError('popup'))
      const result = new Promise<void>((resolve, reject) => {
        pending = { resolve, reject }
      })
      client.requestAccessToken({ prompt, ...(loginHint ? { login_hint: loginHint } : {}) })
      return result
    },

    revoke() {
      const current = token
      token = null
      if (!current || !oauth2) return Promise.resolve()
      const library = oauth2
      return new Promise<void>((resolve) => {
        library.revoke(current.value, resolve)
      })
    },
  }
}
