import { runCheck, runLogin, runLogout } from './cli'

/**
 * devnotes-mcp — the DevNotes MCP server for Claude Code.
 *
 *   devnotes-mcp login    sign in with Google in the browser
 *   devnotes-mcp logout   revoke and delete the saved sign-in
 *   devnotes-mcp check    check that the spreadsheets of the website are visible
 */
const commands: Record<string, () => Promise<number>> = {
  login: runLogin,
  logout: runLogout,
  check: runCheck,
}

async function main(): Promise<number> {
  const name = process.argv[2] ?? ''
  const command = commands[name]
  if (!command) {
    process.stderr.write('Команды: devnotes-mcp login | logout | check\n')
    return 1
  }
  return command()
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    process.stderr.write(`Ошибка: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  },
)
