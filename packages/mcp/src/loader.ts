import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { configDir } from './config'

/**
 * The tiny launcher in the package the site offers for download. npx keeps a
 * downloaded package forever, so the package itself never changes: on every
 * start it fetches the current server from the site (a 304 when nothing is new)
 * and runs it, or runs the copy saved last time when the site cannot be reached.
 */

const SERVER_URL = typeof __DEVNOTES_SERVER_URL__ === 'string' ? __DEVNOTES_SERVER_URL__ : ''
const TIMEOUT_MS = 8000

const say = (line: string) => {
  process.stderr.write(`${line}\n`)
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** The path of an up-to-date server bundle in the settings folder. */
export async function updateServer(
  dir: string,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const file = join(dir, 'server.mjs')
  const metaFile = join(dir, 'server.json')
  let etag = ''
  try {
    const meta = JSON.parse(await readFile(metaFile, 'utf8')) as { etag?: unknown }
    if (typeof meta.etag === 'string' && (await exists(file))) etag = meta.etag
  } catch {
    // No saved copy yet.
  }

  try {
    const response = await fetchImpl(url, {
      headers: etag ? { 'If-None-Match': etag } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status === 200) {
      const code = await response.text()
      await mkdir(dir, { recursive: true, mode: 0o700 })
      await writeFile(`${file}.tmp`, code)
      await rename(`${file}.tmp`, file)
      await writeFile(metaFile, JSON.stringify({ etag: response.headers.get('etag') ?? '' }))
    } else if (response.status !== 304) {
      throw new Error(`HTTP ${String(response.status)}`)
    }
  } catch (error) {
    if (!(await exists(file))) {
      throw new Error(
        `Cannot download the DevNotes MCP server from ${url}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
    say('DevNotes MCP: the site is not reachable, starting the saved copy.')
  }
  return file
}

async function main(): Promise<void> {
  if (SERVER_URL === '') throw new Error('This package was built without a server address')
  const file = await updateServer(configDir(), SERVER_URL)
  await import(pathToFileURL(file).href)
}

// Only when run as the package's command, not when tests import updateServer.
if (typeof __DEVNOTES_SERVER_URL__ === 'string') {
  main().catch((error: unknown) => {
    say(`DevNotes MCP: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
