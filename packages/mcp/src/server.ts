import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { configDir, readCredentials, readLogin } from './config'
import { createSheetsClient } from './google'
import { LoginRequiredError, TokenProvider } from './oauth'
import { DevNotesStore } from './store'
import { registerTools, type StoreSource } from './tools'

export const SERVER_NAME = 'devnotes'
export const SERVER_VERSION = '0.1.0'

export function createDevNotesServer(store: StoreSource): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "DevNotes keeps the user's ideas, bugs and fixes per project in Google Sheets. Use list_projects, then list_notes / get_note to read. " +
        'create_notes puts new cards into the user\'s review queue ("На проверку"), never straight into their notes. ' +
        'There are no tools to delete or archive notes.',
    },
  )
  registerTools(server, store)
  return server
}

/**
 * The store for the saved sign-in. Created on first use, so the server starts
 * (and explains how to sign in) even before `devnotes-mcp login`.
 */
function storeFromSavedLogin(): StoreSource {
  let store: DevNotesStore | null = null
  return async () => {
    if (store) return store
    const dir = configDir()
    const credentials = await readCredentials(dir)
    const saved = await readLogin(dir)
    if (!credentials || !saved) throw new LoginRequiredError('Not signed in')
    const tokens = new TokenProvider(credentials, saved.refreshToken)
    store = new DevNotesStore(createSheetsClient(() => tokens.getAccessToken()))
    return store
  }
}

/** Serves MCP over stdio for Claude Code. Logs go to stderr: stdout is the protocol. */
export async function runServer(): Promise<number> {
  const server = createDevNotesServer(storeFromSavedLogin())
  await server.connect(new StdioServerTransport())
  process.stderr.write('DevNotes MCP server is running on stdio.\n')
  return new Promise<number>(() => {
    // Runs until Claude Code closes stdin or stops the process.
  })
}
