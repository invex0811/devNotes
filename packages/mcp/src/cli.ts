import { readHeader, readMeta, rowToProject, type Project } from '@devnotes/core'
import {
  configDir,
  configFilePath,
  deleteLogin,
  readCredentials,
  readLogin,
  saveLogin,
  type ClientCredentials,
} from './config'
import { GoogleError, createSheetsClient, type SheetsClient } from './google'
import { TokenProvider, login, openInBrowser, revoke } from './oauth'

/** Messages for the person at the terminal (stdout stays free for MCP). */
const say = (line = '') => {
  process.stderr.write(`${line}\n`)
}

async function credentialsOrExplain(dir: string): Promise<ClientCredentials | null> {
  const credentials = await readCredentials(dir)
  if (credentials) return credentials
  say('Не найден OAuth-клиент «Desktop app».')
  say(`Создайте файл ${configFilePath(dir)} с содержимым:`)
  say('{ "clientId": "…apps.googleusercontent.com", "clientSecret": "…" }')
  say('или задайте переменные DEVNOTES_GOOGLE_CLIENT_ID и DEVNOTES_GOOGLE_CLIENT_SECRET.')
  say('Подробно — docs/MCP.md.')
  return null
}

/** A Sheets client for the saved sign-in, or null with an explanation. */
export async function signedInClient(dir = configDir()): Promise<SheetsClient | null> {
  const credentials = await credentialsOrExplain(dir)
  if (!credentials) return null
  const saved = await readLogin(dir)
  if (!saved) {
    say('Вход не выполнен. Запустите: devnotes-mcp login')
    return null
  }
  const tokens = new TokenProvider(credentials, saved.refreshToken)
  return createSheetsClient(() => tokens.getAccessToken())
}

export async function runLogin(): Promise<number> {
  const dir = configDir()
  const credentials = await credentialsOrExplain(dir)
  if (!credentials) return 1
  const refreshToken = await login(credentials, { open: openInBrowser, log: say })
  const tokens = new TokenProvider(credentials, refreshToken)
  const email = await createSheetsClient(() => tokens.getAccessToken()).getEmail()
  await saveLogin(dir, { refreshToken, email })
  say(`Вход выполнен: ${email || 'аккаунт Google'}. Токен сохранён в ${dir}`)
  return 0
}

export async function runLogout(): Promise<number> {
  const dir = configDir()
  const saved = await readLogin(dir)
  if (saved) await revoke(saved.refreshToken).catch(() => undefined)
  await deleteLogin(dir)
  say('Выход выполнен, сохранённый токен удалён.')
  return 0
}

/**
 * The risk check of stage 6: does the desktop client see the spreadsheets the
 * website created? Reads the home spreadsheet and every project's meta sheet.
 */
export async function runCheck(): Promise<number> {
  const client = await signedInClient()
  if (!client) return 1
  say(`Аккаунт: ${await client.getEmail()}`)

  const home = await client.findHomeSpreadsheet()
  if (!home) {
    say('Личная таблица DevNotes НЕ найдена.')
    say('Либо на сайте этим аккаунтом ещё не входили, либо десктоп-клиент не видит')
    say('таблицы, созданные сайтом (область drive.file). Проверьте, тот ли аккаунт.')
    return 2
  }

  let ok = true
  try {
    const [, projectRows = []] = await client.getValues(home, ['meta', 'projects'])
    say(`Личная таблица найдена и читается: ${home}`)
    const header = readHeader(projectRows[0])
    const projects = projectRows
      .slice(1)
      .map((row) => rowToProject(row, header))
      .filter((project): project is Project => project !== null && !project.removed)
    say(`Проектов в списке: ${String(projects.length)}`)
    for (const project of projects) {
      try {
        const [metaRows = []] = await client.getValues(project.spreadsheetId, ['meta'])
        const kind = readMeta(metaRows).get('kind') ?? '?'
        say(`  ✔ ${project.name} (${project.role}): читается, meta.kind=${kind}`)
      } catch (error) {
        ok = false
        const status = error instanceof GoogleError ? ` HTTP ${String(error.status)}` : ''
        say(`  ✘ ${project.name} (${project.role}): не читается${status}`)
      }
    }
  } catch (error) {
    say(`Личная таблица найдена, но не читается: ${String(error)}`)
    return 2
  }
  say(ok ? 'Итог: десктоп-клиент видит таблицы сайта.' : 'Итог: часть таблиц не видна.')
  return ok ? 0 : 2
}
