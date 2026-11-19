import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { ClientCredentials } from './config'

/**
 * Google sign-in for a desktop app: loopback redirect and PKCE.
 * https://developers.google.com/identity/protocols/oauth2/native-app
 */

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const EXPIRY_MARGIN_MS = 60_000

/** The saved sign-in is missing, revoked or expired: `devnotes-mcp login` is needed. */
export class LoginRequiredError extends Error {
  override name = 'LoginRequiredError'
}

/** There is no OAuth client at all: neither built in, nor in settings. */
export class SetupRequiredError extends Error {
  override name = 'SetupRequiredError'
}

/** A browser sign-in was just started; the user should finish it and ask again. */
export class SignInStartedError extends Error {
  override name = 'SignInStartedError'
  /** The sign-in address, in case the browser did not open; empty when unknown. */
  readonly url: string
  constructor(url: string) {
    super('Sign-in started in the browser')
    this.url = url
  }
}

/** How long a started sign-in waits for the user. */
const SIGN_IN_TIMEOUT_MS = 10 * 60_000

const base64url = (data: Buffer) => data.toString('base64url')

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

async function tokenRequest(
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<TokenResponse> {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  return (await response.json()) as TokenResponse
}

/** Opens a URL in the default browser without passing it through a shell. */
export function openInBrowser(url: string): void {
  const [command, args] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  const child = spawn(command, args, { stdio: 'ignore', detached: true })
  child.on('error', () => undefined)
  child.unref()
}

const PAGE = (message: string) =>
  `<!doctype html><meta charset="utf-8"><title>DevNotes</title><body style="font-family:sans-serif;background:#0f1115;color:#e8eaf0;padding:3rem"><h1>DevNotes</h1><p>${message}</p></body>`

/**
 * Runs the browser sign-in and returns the refresh token. The answer comes to a
 * one-time listener on 127.0.0.1 with a random free port.
 */
export async function login(
  credentials: ClientCredentials,
  options: { open: (url: string) => void; log: (line: string) => void; fetch?: typeof fetch },
): Promise<string> {
  const fetchImpl = options.fetch ?? fetch
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(16))

  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  const redirectUri = `http://127.0.0.1:${String(port)}`

  const code = new Promise<string>((resolve, reject) => {
    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', redirectUri)
      const error = url.searchParams.get('error')
      const value = url.searchParams.get('code')
      if (!error && !value) {
        response.writeHead(404).end()
        return
      }
      const ok = !error && url.searchParams.get('state') === state && value
      response
        .writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
        .end(PAGE(ok ? 'Вход выполнен. Это окно можно закрыть.' : 'Вход не выполнен.'))
      if (ok) resolve(value)
      else reject(new Error(error ?? 'The sign-in answer did not match the request'))
    })
    const timer = setTimeout(() => {
      reject(new Error('Nobody finished the sign-in in time'))
    }, SIGN_IN_TIMEOUT_MS)
    timer.unref()
  })

  const authUrl = `${AUTH_URL}?${new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_FILE_SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
  }).toString()}`

  options.log('Открываю браузер для входа в Google. Если он не открылся, перейдите по адресу:')
  options.log(authUrl)
  options.open(authUrl)

  try {
    const result = await tokenRequest(
      {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code: await code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
      fetchImpl,
    )
    if (!result.refresh_token) {
      throw new Error(
        result.error_description ?? result.error ?? 'Google returned no refresh token',
      )
    }
    return result.refresh_token
  } finally {
    server.close()
  }
}

/** Short-lived access tokens from the saved refresh token, kept in memory only. */
export class TokenProvider {
  private token: { value: string; expiresAt: number } | null = null
  private readonly credentials: ClientCredentials
  private readonly refreshToken: string
  private readonly fetchImpl: typeof fetch

  constructor(
    credentials: ClientCredentials,
    refreshToken: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.credentials = credentials
    this.refreshToken = refreshToken
    this.fetchImpl = fetchImpl
  }

  async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value
    const result = await tokenRequest(
      {
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      },
      this.fetchImpl,
    )
    if (!result.access_token) {
      throw new LoginRequiredError(result.error_description ?? result.error ?? 'No access token')
    }
    this.token = {
      value: result.access_token,
      expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 - EXPIRY_MARGIN_MS,
    }
    return this.token.value
  }
}

/** Revokes the refresh token (and the access tokens issued with it) at Google. */
export async function revoke(token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await fetchImpl(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }).toString(),
  })
}
