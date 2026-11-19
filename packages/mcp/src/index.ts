// Placeholder entry point. The MCP server itself is built at stage 6 of the spec;
// this file only keeps the workspace wired into lint and type checks until then.
import { SCHEMA_VERSION } from '@devnotes/core'

process.stderr.write(
  `DevNotes MCP server is not implemented yet (data schema v${String(SCHEMA_VERSION)}).\n`,
)
process.exitCode = 1
