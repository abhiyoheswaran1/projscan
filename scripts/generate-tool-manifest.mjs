/**
 * Emit a stable, versioned manifest of the MCP tool surface so external
 * consumers (e.g. the projscan website docs page) can render per-tool
 * reference pages without parsing TypeScript or scraping source.
 *
 * Output: dist/tool-manifest.json
 *
 * Schema:
 *   {
 *     name: "projscan",
 *     version: "0.11.0",
 *     mcpProtocolVersion: "2025-03-26",
 *     generatedAt: "2026-04-25T...",
 *     toolCount: 17,
 *     tools: [
 *       { name, description, inputSchema },
 *       ...
 *     ]
 *   }
 *
 * Runs as the third post-build step. Reads the COMPILED tool definitions
 * from dist/ rather than src/ so we get the same metadata the runtime
 * actually serves on `tools/list`.
 */

import { writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distDir = path.join(root, 'dist');

// Sanity: dist/ must exist (this script is supposed to run after tsc).
try {
  await stat(distDir);
} catch {
  throw new Error(`dist/ not found at ${distDir}. Run \`tsc\` before this script.`);
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf-8'));

// Pull the live tool definitions from the compiled dispatcher. Importing
// dist/mcp/tools.js executes the module-level tool-array literal; that's
// side-effect-free.
const { getToolDefinitions } = await import(path.join(distDir, 'mcp', 'tools.js'));
const tools = getToolDefinitions();

// MCP protocol version is declared in dist/mcp/server.js but not exported.
// Read it from source instead - cheap and always-current.
const serverSource = await readFile(path.join(distDir, 'mcp', 'server.js'), 'utf-8');
const protoMatch = /SUPPORTED_PROTOCOL_VERSIONS\s*=\s*\[\s*['"]([^'"]+)['"]/.exec(serverSource);
const mcpProtocolVersion = protoMatch ? protoMatch[1] : null;

const manifest = {
  name: pkg.name,
  version: pkg.version,
  mcpProtocolVersion,
  generatedAt: new Date().toISOString(),
  toolCount: tools.length,
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
};

const outPath = path.join(distDir, 'tool-manifest.json');
await writeFile(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

const { size } = await stat(outPath);
console.log(`generated tool-manifest.json (${manifest.toolCount} tools, ${(size / 1024).toFixed(1)} KB)`);
