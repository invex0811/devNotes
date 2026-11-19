import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves a project site from /<repo>/. CI passes that path in BASE_PATH
// (taken from the Pages settings), so the repository name is never hardcoded here.
function resolveBase(): string {
  const raw = process.env.BASE_PATH?.trim()
  if (!raw) return '/'
  return raw.endsWith('/') ? raw : `${raw}/`
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
  // Google sign-in accepts only the origins listed in the OAuth client, and that is
  // http://localhost:5173 for development. With strictPort a busy port is an error
  // instead of a silent move to 5174, where sign-in would fail with origin_mismatch.
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
