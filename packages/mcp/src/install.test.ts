import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readCredentials, saveLogin } from './config'
import { updateServer } from './loader'
import { SetupRequiredError, SignInStartedError } from './oauth'
import { storeFromSavedLogin } from './server'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'devnotes-mcp-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const builtIn = { clientId: 'built-in.apps.googleusercontent.com', clientSecret: 'b' }

describe('client credentials', () => {
  it('uses the client built into the downloaded package when nothing else is set', async () => {
    expect(await readCredentials(dir, {}, builtIn)).toEqual(builtIn)
    expect(await readCredentials(dir, {}, null)).toBeNull()
  })

  it('prefers config.json, and environment variables over both', async () => {
    await writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ clientId: 'file-id', clientSecret: 'f' }),
    )
    expect(await readCredentials(dir, {}, builtIn)).toEqual({
      clientId: 'file-id',
      clientSecret: 'f',
    })
    expect(
      await readCredentials(
        dir,
        { DEVNOTES_GOOGLE_CLIENT_ID: 'env-id', DEVNOTES_GOOGLE_CLIENT_SECRET: 'e' },
        builtIn,
      ),
    ).toEqual({ clientId: 'env-id', clientSecret: 'e' })
  })
})

describe('sign-in on first use', () => {
  it('opens the browser once and asks to retry while the user signs in', async () => {
    await writeFile(join(dir, 'config.json'), JSON.stringify({ clientId: 'id', clientSecret: 's' }))
    const opened: string[] = []
    const signIn = vi.fn(
      (_credentials: unknown, open: (url: string) => void) =>
        new Promise<string>(() => {
          open('https://accounts.google.com/o/oauth2/v2/auth?client_id=id')
        }),
    )
    const store = storeFromSavedLogin({
      dir,
      signIn,
      openBrowser: (url) => opened.push(url),
      log: () => undefined,
    })

    const first = await store().catch((error: unknown) => error)
    const second = await store().catch((error: unknown) => error)

    expect(first).toBeInstanceOf(SignInStartedError)
    expect((first as SignInStartedError).url).toMatch(/^https:\/\/accounts\.google\.com\//)
    expect(second).toBeInstanceOf(SignInStartedError)
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(opened).toHaveLength(1)
  })

  it('uses a saved sign-in without opening the browser', async () => {
    await writeFile(join(dir, 'config.json'), JSON.stringify({ clientId: 'id', clientSecret: 's' }))
    await saveLogin(dir, { refreshToken: 'refresh', email: 'user@example.com' })
    const signIn = vi.fn()
    const store = storeFromSavedLogin({ dir, signIn, openBrowser: vi.fn(), log: () => undefined })
    await expect(store()).resolves.toBeDefined()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('explains a missing OAuth client', async () => {
    const store = storeFromSavedLogin({ dir, openBrowser: vi.fn(), log: () => undefined })
    await expect(store()).rejects.toBeInstanceOf(SetupRequiredError)
  })
})

describe('launcher', () => {
  const URL = 'https://example.github.io/devNotes/devnotes-mcp/server.mjs'

  it('downloads the server, then asks with its ETag and keeps the copy on 304', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('export const v = 1', { status: 200, headers: { ETag: '"one"' } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }))

    const file = await updateServer(dir, URL, fetchImpl)
    expect(await readFile(file, 'utf8')).toBe('export const v = 1')

    await updateServer(dir, URL, fetchImpl)
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toEqual({ 'If-None-Match': '"one"' })
    expect(await readFile(file, 'utf8')).toBe('export const v = 1')
  })

  it('takes a new version when the site has one', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('v1', { status: 200, headers: { ETag: '"one"' } }))
      .mockResolvedValueOnce(new Response('v2', { status: 200, headers: { ETag: '"two"' } }))
    await updateServer(dir, URL, fetchImpl)
    const file = await updateServer(dir, URL, fetchImpl)
    expect(await readFile(file, 'utf8')).toBe('v2')
  })

  it('starts the saved copy when the site cannot be reached', async () => {
    const online = vi.fn<typeof fetch>().mockResolvedValue(new Response('v1', { status: 200 }))
    await updateServer(dir, URL, online)
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    const file = await updateServer(dir, URL, offline)
    expect(await readFile(file, 'utf8')).toBe('v1')
  })

  it('fails clearly without a saved copy and without the site', async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    await expect(updateServer(dir, URL, offline)).rejects.toThrow(/Cannot download/)
  })
})
