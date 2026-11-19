import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Where the MCP server keeps its settings and the refresh token: the user's own
 * settings folder, never the repository.
 */
export function configDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (env.DEVNOTES_MCP_HOME) return env.DEVNOTES_MCP_HOME
  if (platform === 'win32') {
    return join(env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'devnotes-mcp')
  }
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'devnotes-mcp')
  }
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'devnotes-mcp')
}

/** The "Desktop app" OAuth client of the same Google Cloud project as the website. */
export interface ClientCredentials {
  clientId: string
  clientSecret: string
}

const CONFIG_FILE = 'config.json'
const TOKEN_FILE = 'token.json'

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = JSON.parse(await readFile(path, 'utf8'))
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/**
 * Client ID and secret from `DEVNOTES_GOOGLE_CLIENT_ID` and
 * `DEVNOTES_GOOGLE_CLIENT_SECRET`, otherwise from `config.json` in the settings folder.
 */
export async function readCredentials(
  dir: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ClientCredentials | null> {
  const fromEnv = {
    clientId: text(env.DEVNOTES_GOOGLE_CLIENT_ID),
    clientSecret: text(env.DEVNOTES_GOOGLE_CLIENT_SECRET),
  }
  if (fromEnv.clientId !== '') return fromEnv
  const file = await readJson(join(dir, CONFIG_FILE))
  const clientId = text(file?.clientId)
  if (clientId === '') return null
  return { clientId, clientSecret: text(file?.clientSecret) }
}

export interface SavedLogin {
  refreshToken: string
  email: string
}

export async function readLogin(dir: string): Promise<SavedLogin | null> {
  const file = await readJson(join(dir, TOKEN_FILE))
  const refreshToken = text(file?.refreshToken)
  return refreshToken === '' ? null : { refreshToken, email: text(file?.email) }
}

/** Saves the refresh token readable by the owner only. */
export async function saveLogin(dir: string, login: SavedLogin): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const path = join(dir, TOKEN_FILE)
  await writeFile(path, `${JSON.stringify(login, null, 2)}\n`, { mode: 0o600 })
  // On Windows the file inherits the private ACL of the user's profile folder.
  await chmod(path, 0o600).catch(() => undefined)
}

export async function deleteLogin(dir: string): Promise<void> {
  await rm(join(dir, TOKEN_FILE), { force: true })
}

export function configFilePath(dir: string): string {
  return join(dir, CONFIG_FILE)
}
