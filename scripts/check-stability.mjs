#!/usr/bin/env node
/**
 * Stable-surface CI guard for projscan (0.13.0+).
 *
 * Compares the live stable surface — MCP tool inventory, CLI command list,
 * exit codes — against a checked-in baseline (`stability-baseline.json`).
 * The check enforces the rules in `docs/STABILITY.md`:
 *
 *   ALLOWED on minor / patch bumps:
 *     - Adding a new MCP tool
 *     - Adding a new optional argument to an existing tool
 *     - Adding a new CLI command
 *
 *   REQUIRES a major bump (and so fails this guard):
 *     - Removing or renaming an MCP tool
 *     - Removing or renaming an existing argument
 *     - Removing a CLI command
 *     - Changing an existing exit code's meaning
 *
 * Usage:
 *   node scripts/check-stability.mjs           - check; exits 1 on regression
 *   node scripts/check-stability.mjs --update  - rewrite the baseline (only
 *                                                run this when intentionally
 *                                                cutting a major version)
 *
 * The baseline file lives at the repo root: `stability-baseline.json`.
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distDir = path.join(root, 'dist');
const manifestPath = path.join(distDir, 'tool-manifest.json');
const baselinePath = path.join(root, 'stability-baseline.json');

// CLI commands that are part of the stable surface (per STABILITY.md). Edit
// this list ONLY on a major version bump; otherwise additions go through
// the baseline-diff path automatically.
const STABLE_CLI_COMMANDS = [
  'analyze', 'doctor', 'ci', 'hotspots', 'coupling', 'pr-diff', 'review',
  'fix-suggest', 'explain-issue',
  'dependencies', 'outdated', 'audit', 'coverage', 'search', 'structure',
  'explain', 'badge', 'diff', 'workspaces', 'mcp',
];

const STABLE_EXIT_CODES = {
  success: 0,
  issues: 1,
  invalidUsage: 2,
};

const args = new Set(process.argv.slice(2));
const updateMode = args.has('--update');

// ── Load the live surface ─────────────────────────────────

let manifest;
try {
  await stat(manifestPath);
} catch {
  fail(`tool-manifest.json missing at ${manifestPath}. Run \`npm run build\` first.`);
}
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
} catch (err) {
  fail(`Could not parse ${manifestPath}: ${err.message}`);
}

const liveSurface = {
  schemaVersion: 1,
  mcpTools: {},
  cliCommands: [...STABLE_CLI_COMMANDS].sort(),
  exitCodes: STABLE_EXIT_CODES,
};

for (const tool of manifest.tools) {
  const props = tool.inputSchema?.properties ?? {};
  const required = tool.inputSchema?.required ?? [];
  liveSurface.mcpTools[tool.name] = {
    args: Object.keys(props).sort(),
    required: [...required].sort(),
  };
}

// ── Update mode: rewrite the baseline and exit ────────────

if (updateMode) {
  await writeFile(baselinePath, JSON.stringify(liveSurface, null, 2) + '\n', 'utf-8');
  console.log(`✓ stability baseline updated at ${path.relative(root, baselinePath)}`);
  console.log(
    '  Only do this on a deliberate major version bump or when intentionally',
  );
  console.log('  expanding the stable surface (e.g. promoting a tool to GA).');
  process.exit(0);
}

// ── Check mode: load + diff ───────────────────────────────

let baseline;
try {
  baseline = JSON.parse(await readFile(baselinePath, 'utf-8'));
} catch (err) {
  if (err.code === 'ENOENT') {
    fail(
      `No baseline file at ${path.relative(root, baselinePath)}. Run\n` +
        `  node scripts/check-stability.mjs --update\n` +
        `to bootstrap one (only on a deliberate major bump).`,
    );
  }
  fail(`Could not parse baseline: ${err.message}`);
}

const issues = [];

// MCP tools: tracked individually.
const baselineToolNames = new Set(Object.keys(baseline.mcpTools ?? {}));
const liveToolNames = new Set(Object.keys(liveSurface.mcpTools));

for (const name of baselineToolNames) {
  if (!liveToolNames.has(name)) {
    issues.push(`REMOVED MCP tool: ${name}`);
  }
}

for (const name of baselineToolNames) {
  if (!liveToolNames.has(name)) continue;
  const baseTool = baseline.mcpTools[name];
  const liveTool = liveSurface.mcpTools[name];
  for (const arg of baseTool.args) {
    if (!liveTool.args.includes(arg)) {
      issues.push(`REMOVED arg from ${name}: ${arg}`);
    }
  }
  // Required args may NOT change mid-major. New args may be added but not as required.
  const baseRequired = new Set(baseTool.required);
  const liveRequired = new Set(liveTool.required);
  for (const r of liveRequired) {
    if (!baseRequired.has(r)) {
      issues.push(`NEW required arg in ${name}: ${r} (must be optional within a major version)`);
    }
  }
  for (const r of baseRequired) {
    if (!liveRequired.has(r)) {
      issues.push(`required arg ${r} in ${name} is no longer required (allowed but flag for review)`);
    }
  }
}

// CLI commands: removal is a break.
for (const cmd of baseline.cliCommands ?? []) {
  if (!liveSurface.cliCommands.includes(cmd)) {
    issues.push(`REMOVED CLI command: ${cmd}`);
  }
}

// Exit codes: meaning may not flip.
for (const [k, v] of Object.entries(baseline.exitCodes ?? {})) {
  if (liveSurface.exitCodes[k] !== v) {
    issues.push(`exit code "${k}" changed: ${v} → ${liveSurface.exitCodes[k]}`);
  }
}

// ── Surface additions (informational, not failures) ───────
const additions = [];
for (const name of liveToolNames) {
  if (!baselineToolNames.has(name)) additions.push(`+ MCP tool: ${name}`);
}
for (const name of liveToolNames) {
  if (!baselineToolNames.has(name)) continue;
  const baseArgs = new Set(baseline.mcpTools[name].args);
  for (const arg of liveSurface.mcpTools[name].args) {
    if (!baseArgs.has(arg)) additions.push(`+ arg ${arg} in ${name}`);
  }
}
for (const cmd of liveSurface.cliCommands) {
  if (!(baseline.cliCommands ?? []).includes(cmd)) additions.push(`+ CLI command: ${cmd}`);
}

// ── Report ────────────────────────────────────────────────

if (additions.length > 0) {
  console.log('Stable-surface additions (allowed on minor/patch):');
  for (const a of additions) console.log(`  ${a}`);
  console.log('');
}

if (issues.length === 0) {
  console.log(`✓ stable surface holds against ${path.relative(root, baselinePath)}`);
  process.exit(0);
}

console.error('✗ stable-surface regressions detected:');
for (const issue of issues) console.error(`  ${issue}`);
console.error('');
console.error(
  'These changes require a major version bump. If that is intentional, run:\n' +
    '  node scripts/check-stability.mjs --update\n' +
    'to refresh the baseline. Otherwise, restore the removed/renamed surface.',
);
process.exit(1);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
