// Bundles the MCP server into dist/index.js. The shared core is bundled in, since it
// ships TypeScript sources; npm packages stay external and load from node_modules.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['@modelcontextprotocol/sdk', 'zod'],
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
})
