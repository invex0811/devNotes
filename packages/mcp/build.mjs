// Builds the MCP server.
//
//   node build.mjs                  dist/index.js for development: npm packages stay
//                                   external and load from node_modules.
//   node build.mjs release <dir>    what the site offers for download, written to <dir>:
//     devnotes-mcp/server.mjs       the whole server in one file, with the site's
//                                   desktop OAuth client built in;
//     devnotes-mcp.tgz              an npm package with a tiny launcher that fetches
//                                   server.mjs on every start (npx never updates a
//                                   package it has downloaded once).
//
// The release reads DEVNOTES_MCP_CLIENT_ID, DEVNOTES_MCP_CLIENT_SECRET (repository
// variables in CI) and DEVNOTES_MCP_SERVER_URL (where server.mjs is published).
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'warning',
}
const shebang = '#!/usr/bin/env node'
// Bundled CommonJS dependencies call require(); an ES module has to provide it.
const requireShim =
  "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);"

const define = (name, value) => ({ [name]: JSON.stringify(value ?? '') })

const [mode, outArg] = process.argv.slice(2)

if (mode !== 'release') {
  await build({
    ...common,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    external: ['@modelcontextprotocol/sdk', 'zod'],
    banner: { js: shebang },
  })
} else {
  if (!outArg) throw new Error('Usage: node build.mjs release <output folder>')
  const out = resolve(outArg)
  const serverUrl = process.env.DEVNOTES_MCP_SERVER_URL ?? ''
  // https only; plain http just for trying a release on this computer.
  if (!/^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(serverUrl)) {
    throw new Error('DEVNOTES_MCP_SERVER_URL must be the https address of devnotes-mcp/server.mjs')
  }
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version

  await build({
    ...common,
    entryPoints: ['src/index.ts'],
    outfile: join(out, 'devnotes-mcp', 'server.mjs'),
    banner: { js: requireShim },
    define: {
      ...define('__DEVNOTES_CLIENT_ID__', process.env.DEVNOTES_MCP_CLIENT_ID),
      ...define('__DEVNOTES_CLIENT_SECRET__', process.env.DEVNOTES_MCP_CLIENT_SECRET),
    },
  })

  const staging = mkdtempSync(join(tmpdir(), 'devnotes-mcp-'))
  try {
    await build({
      ...common,
      entryPoints: ['src/loader.ts'],
      outfile: join(staging, 'loader.js'),
      banner: { js: shebang },
      define: define('__DEVNOTES_SERVER_URL__', serverUrl),
    })
    writeFileSync(
      join(staging, 'package.json'),
      `${JSON.stringify(
        {
          name: 'devnotes-mcp',
          version,
          description: 'DevNotes MCP server for Claude Code',
          type: 'module',
          bin: { 'devnotes-mcp': 'loader.js' },
          engines: { node: '>=22.12.0' },
        },
        null,
        2,
      )}\n`,
    )
    mkdirSync(out, { recursive: true })
    // A command string, so npm.cmd is found on Windows too.
    const packed = execSync(`npm pack --silent --pack-destination "${out}"`, {
      cwd: staging,
      encoding: 'utf8',
    }).trim()
    renameSync(join(out, packed.split(/\r?\n/).at(-1)), join(out, 'devnotes-mcp.tgz'))
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
  console.log(`DevNotes MCP ${version}: ${join(out, 'devnotes-mcp.tgz')}, ${serverUrl}`)
}
