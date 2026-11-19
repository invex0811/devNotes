import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { configDir, readCredentials, readLogin, saveLogin, type ClientCredentials } from './config'
import { createSheetsClient } from './google'
import {
  LoginRequiredError,
  SetupRequiredError,
  SignInStartedError,
  TokenProvider,
  login,
  openInBrowser,
} from './oauth'
import { DevNotesStore } from './store'
import { registerTools, type StoreSource } from './tools'

export const SERVER_NAME = 'devnotes'
export const SERVER_VERSION = '0.2.0'

export function createDevNotesServer(store: StoreSource): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "DevNotes keeps the user's ideas, bugs and fixes per project in Google Sheets. Use list_projects, then list_notes / get_note to read. " +
        'create_notes puts new cards into the user\'s review queue ("На проверку"), never straight into their notes. ' +
        'There are no tools to delete or archive notes. ' +
        'The first call may open a browser window for the user to sign in to Google; then ask the user to finish and retry.',
    },
  )
  registerTools(server, store)
  return server
}

export interface StoreOptions {
  dir?: string
  /** The browser sign-in; replaced in tests. Resolves with the refresh token. */
  signIn?: (credentials: ClientCredentials, open: (url: string) => void) => Promise<string>
  log?: (line: string) => void
  /** Opens the sign-in page; tests pass a stub instead of a real browser. */
  openBrowser?: (url: string) => void
}

/**
 * The store for the saved sign-in, created on first use. Without a sign-in the
 * first tool call starts one in the browser, so a new user needs no `login`
 * command: they sign in with their own Google account and ask again.
 */
export function storeFromSavedLogin(options: StoreOptions = {}): StoreSource {
  const log = options.log ?? ((line: string) => process.stderr.write(`${line}\n`))
  const signIn =
    options.signIn ??
    ((credentials: ClientCredentials, open: (url: string) => void) =>
      login(credentials, { open, log }))
  const openBrowser = options.openBrowser ?? openInBrowser
  let store: DevNotesStore | null = null
  let pending: { url: Promise<string> } | null = null

  const startSignIn = (dir: string, credentials: ClientCredentials) => {
    let resolveUrl: (url: string) => void = () => undefined
    const url = new Promise<string>((resolve) => {
      resolveUrl = resolve
    })
    pending = { url }
    signIn(credentials, (address) => {
      resolveUrl(address)
      openBrowser(address)
    })
      .then(async (refreshToken) => {
        const tokens = new TokenProvider(credentials, refreshToken)
        const email = await createSheetsClient(() => tokens.getAccessToken()).getEmail()
        await saveLogin(dir, { refreshToken, email })
        log(`Signed in to Google as ${email || 'a Google account'}.`)
      })
      .catch((error: unknown) => {
        log(
          `Google sign-in did not finish: ${error instanceof Error ? error.message : String(error)}`,
        )
        resolveUrl('')
      })
      .finally(() => {
        pending = null
      })
    return url
  }

  return async () => {
    if (store) return store
    const dir = options.dir ?? configDir()
    const credentials = await readCredentials(dir)
    if (!credentials) throw new SetupRequiredError('No OAuth client for the MCP server')
    const saved = await readLogin(dir)
    if (!saved) {
      const url = await (pending?.url ?? startSignIn(dir, credentials))
      throw new SignInStartedError(url)
    }
    const tokens = new TokenProvider(credentials, saved.refreshToken)
    store = new DevNotesStore(createSheetsClient(() => tokens.getAccessToken()))
    return store
  }
}

/** Serves MCP over stdio for Claude Code. Logs go to stderr: stdout is the protocol. */
export async function runServer(): Promise<number> {
  const server = createDevNotesServer(storeFromSavedLogin())
  await server.connect(new StdioServerTransport())
  process.stderr.write(`DevNotes MCP server ${SERVER_VERSION} is running on stdio.\n`)
  return new Promise<number>(() => {
    // Runs until Claude Code closes stdin or stops the process.
  })
}

export { LoginRequiredError }
