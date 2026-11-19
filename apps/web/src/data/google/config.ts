export interface GoogleConfig {
  clientId: string
  /** For Google Picker (stage 3). */
  apiKey: string
  /** Google Cloud project number, for Google Picker (stage 3). */
  appId: string
}

/** Values from `apps/web/.env.local` or the CI build; null when Google is not set up. */
export function readGoogleConfig(env: ImportMetaEnv = import.meta.env): GoogleConfig | null {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
  if (clientId === '') return null
  return {
    clientId,
    apiKey: env.VITE_GOOGLE_API_KEY?.trim() ?? '',
    appId: env.VITE_GOOGLE_APP_ID?.trim() ?? '',
  }
}
