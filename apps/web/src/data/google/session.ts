import { HOME_SPREADSHEET_TITLE } from '@devnotes/core'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { createAppStore, type AppStore } from '../../store/appStore'
import { AuthError, TransientError, type GoogleAccount, type GoogleApi } from './api'
import { KV, readCachedSession, type CacheDb } from './cache'
import { TokenRequestError, type TokenFailure, type TokenSource } from './gis'
import { createGoogleStore } from './googleStore'
import { SyncEngine, type SyncEngineOptions, type SyncStatus } from './sync'

/** Why signing in or renewing the session failed, in terms the interface explains. */
export type SignInError = TokenFailure | 'network' | 'otherAccount' | 'failed'

/**
 * `none`: data is shown from the cache but there is no token yet (a returning user).
 * `expired`: Google answered 401 or the token ran out.
 */
export type AuthState = 'none' | 'ok' | 'expired'

export interface SessionActions {
  /** Opens the app from the cache, or the sign-in page when there is none. */
  start: () => Promise<void>
  /** First sign-in. Call right from a click: it opens the Google popup. */
  signIn: () => void
  /** "Continue" / "Renew": a new token for the same account. Call from a click. */
  renew: () => void
  /** Sends the queue and reads all spreadsheets again. */
  refresh: () => Promise<void>
  hasPending: () => Promise<boolean>
  /** Revokes the token, clears the local cache and reloads the page. */
  signOut: () => Promise<void>
}

export interface SessionState {
  phase: 'starting' | 'signIn' | 'app'
  /** The Google sign-in library has loaded: the sign-in button can open its popup. */
  ready: boolean
  auth: AuthState
  sync: SyncStatus
  refreshing: boolean
  account: GoogleAccount | null
  busy: boolean
  error: SignInError | null
  appStore: AppStore | null
  actions: SessionActions
}

export type SessionStore = StoreApi<SessionState>

export interface SessionDeps {
  tokens: TokenSource
  api: GoogleApi
  db: CacheDb
  reload: () => void
  engineOptions?: Partial<SyncEngineOptions>
  /** Re-read the spreadsheets when the tab comes back, at most this often. */
  refreshOnFocusAfterMs?: number
}

class OtherAccountError extends Error {
  override name = 'OtherAccountError'
}

function classify(error: unknown): SignInError {
  if (error instanceof TokenRequestError) return error.reason
  if (error instanceof OtherAccountError) return 'otherAccount'
  if (error instanceof TransientError) return 'network'
  console.error('DevNotes: sign-in failed', error)
  return 'failed'
}

export function createGoogleSession(deps: SessionDeps): SessionStore {
  const { tokens, api, db } = deps
  const focusDelay = deps.refreshOnFocusAfterMs ?? 15_000
  let engine: SyncEngine | null = null
  let started = false
  let lastRefresh = 0

  return createStore<SessionState>()((set, get) => {
    const openApp = (account: GoogleAccount, homeSpreadsheetId: string, auth: AuthState) => {
      engine?.stop()
      const current = new SyncEngine({ api, db, homeSpreadsheetId, ...deps.engineOptions })
      engine = current
      current.onStatus((sync) => {
        if (engine !== current) return
        set({ sync, ...(sync === 'auth' && get().auth === 'ok' ? { auth: 'expired' } : {}) })
      })
      const dataStore = createGoogleStore({ api, db, engine: current })
      set({
        phase: 'app',
        auth,
        account,
        sync: current.status,
        appStore: createAppStore({ dataStore }),
      })
      return current
    }

    /** After a token is in hand: find or create the home spreadsheet and read everything. */
    const enterAccount = async (account: GoogleAccount) => {
      const home =
        (await api.findSpreadsheet('home')) ??
        (await api.createSpreadsheet('home', HOME_SPREADSHEET_TITLE, HOME_SPREADSHEET_TITLE))
      await db.setValue(KV.account, account)
      await db.setValue(KV.homeSpreadsheetId, home)
      const current = openApp(account, home, 'ok')
      await current.refresh()
      lastRefresh = Date.now()
    }

    const run = (work: Promise<void>) => {
      set({ busy: true, error: null })
      work.then(
        () => {
          set({ busy: false })
        },
        (error: unknown) => {
          set({ busy: false, error: classify(error) })
        },
      )
    }

    const sync = async () => {
      if (!engine) return
      set({ refreshing: true })
      try {
        await engine.flushNow()
        await engine.refresh()
        lastRefresh = Date.now()
      } catch (error) {
        // AuthError and TransientError are already shown by the indicator.
        if (!(error instanceof AuthError || error instanceof TransientError)) {
          console.error('DevNotes: refresh failed', error)
        }
      } finally {
        set({ refreshing: false })
      }
    }

    const listen = () => {
      window.addEventListener('online', () => {
        void engine?.flushNow()
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || get().auth !== 'ok') return
        if (Date.now() - lastRefresh >= focusDelay) void sync()
      })
    }

    const actions: SessionActions = {
      async start() {
        if (started) return
        started = true
        listen()
        tokens.ready().then(
          () => {
            set({ ready: true })
          },
          (error: unknown) => {
            console.error('DevNotes: Google sign-in library failed to load', error)
          },
        )
        const cached = await readCachedSession(db)
        if (!cached) {
          set({ phase: 'signIn' })
          return
        }
        // Notes from the cache right away. Tokens are never stored, so there is
        // none yet: syncing (and any queue left from last time) waits for "Continue".
        openApp(cached.account, cached.homeSpreadsheetId, 'none')
      },

      signIn() {
        if (get().busy) return
        const token = tokens.request({ prompt: 'select_account' })
        run(
          token.then(async () => {
            await enterAccount(await api.getAccount())
          }),
        )
      },

      renew() {
        if (get().busy) return
        const known = get().account
        const token = tokens.request({
          prompt: '',
          ...(known?.email ? { loginHint: known.email } : {}),
        })
        run(
          token.then(async () => {
            const account = await api.getAccount()
            if (known && account.id !== known.id) {
              // Another account was picked. Its data must not mix with the cached one.
              if (await engine?.hasPending()) {
                await tokens.revoke()
                throw new OtherAccountError(known.email)
              }
              engine?.stop()
              await Promise.all(db.tables.map((table) => table.clear()))
              await enterAccount(account)
              return
            }
            await db.setValue(KV.account, account)
            set({ auth: 'ok', account })
            await sync()
          }),
        )
      },

      refresh: sync,

      async hasPending() {
        return (await engine?.hasPending()) ?? false
      },

      async signOut() {
        engine?.stop()
        await tokens.revoke()
        await db.delete()
        deps.reload()
      },
    }

    return {
      phase: 'starting',
      ready: false,
      auth: 'none',
      sync: 'synced',
      refreshing: false,
      account: null,
      busy: false,
      error: null,
      appStore: null,
      actions,
    }
  })
}
