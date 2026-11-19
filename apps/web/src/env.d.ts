/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_GOOGLE_API_KEY?: string
  readonly VITE_GOOGLE_APP_ID?: string
  /** "1" when the site publishes the MCP server package (CI, see ci.yml). */
  readonly VITE_DEVNOTES_MCP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
