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
import {
  compareStableSurface,
  createStableSurface as createSurfaceFromManifest,
} from './stability-surface.mjs';

export { compareStableSurface };

const scriptPath = fileURLToPath(import.meta.url);
const here = path.dirname(scriptPath);
const defaultRoot = path.resolve(here, '..');

// CLI commands that are part of the stable surface (per STABILITY.md). Edit
// this list ONLY on a major version bump; otherwise additions go through
// the baseline-diff path automatically.
const STABLE_CLI_COMMANDS = [
  'agent-brief',
  'analyze',
  'apply-fix',
  'audit',
  'badge',
  'bug-hunt',
  'ci',
  'coupling',
  'coverage',
  'dataflow',
  'dependencies',
  'diagram',
  'diff',
  'doctor',
  'dogfood',
  'evidence-pack',
  'explain-issue',
  'feedback',
  'file',
  'first-run',
  'fix',
  'fix-suggest',
  'handoff',
  'hotspots',
  'impact',
  'init',
  'install-hook',
  'mcp',
  'memory',
  'outdated',
  'plugin',
  'preflight',
  'pr-diff',
  'quality-scorecard',
  'recipes',
  'release-train',
  'regression-plan',
  'review',
  'search',
  'semantic-graph',
  'session',
  'structure',
  'taint',
  'trial',
  'understand',
  'upgrade',
  'watch',
  'workplan',
  'workspace',
  'workspaces',
];

const STABLE_EXIT_CODES = {
  success: 0,
  issues: 1,
  invalidUsage: 2,
};

export function createStableSurface(manifest, options = {}) {
  return createSurfaceFromManifest(manifest, {
    cliCommands: STABLE_CLI_COMMANDS,
    exitCodes: STABLE_EXIT_CODES,
    ...options,
  });
}

export async function createStabilityCheckReport(options = {}) {
  const root = path.resolve(options.root ?? defaultRoot);
  const manifestPath = options.manifestPath ?? path.join(root, 'dist', 'tool-manifest.json');
  const baselinePath = options.baselinePath ?? path.join(root, 'stability-baseline.json');
  const manifest = await readManifest(manifestPath);
  const baseline = await readBaseline(baselinePath, root);
  const liveSurface = createStableSurface(manifest, options);

  return {
    ...compareStableSurface(baseline, liveSurface),
    baselinePath: path.relative(root, baselinePath),
  };
}

export async function updateStabilityBaseline(options = {}) {
  const root = path.resolve(options.root ?? defaultRoot);
  const manifestPath = options.manifestPath ?? path.join(root, 'dist', 'tool-manifest.json');
  const baselinePath = options.baselinePath ?? path.join(root, 'stability-baseline.json');
  const manifest = await readManifest(manifestPath);
  const liveSurface = createStableSurface(manifest, options);
  await writeFile(baselinePath, JSON.stringify(liveSurface, null, 2) + '\n', 'utf-8');
  return {
    baselinePath: path.relative(root, baselinePath),
    liveSurface,
  };
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  if (args.has('--update')) {
    const report = await updateStabilityBaseline();
    console.log(`✓ stability baseline updated at ${report.baselinePath}`);
    console.log('  Only do this on a deliberate major version bump or when intentionally');
    console.log('  expanding the stable surface (e.g. promoting a tool to GA).');
    return 0;
  }

  const report = await createStabilityCheckReport();
  printStabilityReport(report);
  return report.status === 'pass' ? 0 : 1;
}

async function readManifest(manifestPath) {
  try {
    await stat(manifestPath);
  } catch {
    throw new Error(`tool-manifest.json missing at ${manifestPath}. Run \`npm run build\` first.`);
  }
  try {
    return JSON.parse(await readFile(manifestPath, 'utf-8'));
  } catch (err) {
    throw new Error(`Could not parse ${manifestPath}: ${err.message}`);
  }
}

async function readBaseline(baselinePath, root) {
  try {
    return JSON.parse(await readFile(baselinePath, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `No baseline file at ${path.relative(root, baselinePath)}. Run\n` +
          `  node scripts/check-stability.mjs --update\n` +
          `to bootstrap one (only on a deliberate major bump).`,
      );
    }
    throw new Error(`Could not parse baseline: ${err.message}`);
  }
}

function printStabilityReport(report) {
  if (report.additions.length > 0) {
    console.log('Stable-surface additions (allowed on minor/patch):');
    for (const addition of report.additions) console.log(`  ${addition}`);
    console.log('');
  }

  if (report.issues.length === 0) {
    console.log(`✓ stable surface holds against ${report.baselinePath}`);
    return;
  }

  console.error('✗ stable-surface regressions detected:');
  for (const issue of report.issues) console.error(`  ${issue}`);
  console.error('');
  console.error(
    'These changes require a major version bump. If that is intentional, run:\n' +
      '  node scripts/check-stability.mjs --update\n' +
      'to refresh the baseline. Otherwise, restore the removed/renamed surface.',
  );
}

if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    process.exit(await runCli());
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
