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

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { compareStableSurface } from './stability-surface.mjs';
import { createStableSurface } from './stability-contract.mjs';
import {
  readBaseline,
  readManifest,
  relativeBaselinePath,
  resolveStabilityPaths,
  writeBaseline,
} from './stability-files.mjs';
import {
  printStabilityError,
  printStabilityReport,
  printStabilityUpdateReport,
} from './stability-report.mjs';

export { compareStableSurface, createStableSurface };

const scriptPath = fileURLToPath(import.meta.url);
const here = path.dirname(scriptPath);
const defaultRoot = path.resolve(here, '..');

export async function createStabilityCheckReport(options = {}) {
  const paths = resolveStabilityPaths(options, defaultRoot);
  const manifest = await readManifest(paths.manifestPath);
  const baseline = await readBaseline(paths.baselinePath, paths.root);
  const liveSurface = createStableSurface(manifest, options);

  return {
    ...compareStableSurface(baseline, liveSurface),
    baselinePath: relativeBaselinePath(paths.root, paths.baselinePath),
  };
}

export async function updateStabilityBaseline(options = {}) {
  const paths = resolveStabilityPaths(options, defaultRoot);
  const manifest = await readManifest(paths.manifestPath);
  const liveSurface = createStableSurface(manifest, options);
  await writeBaseline(paths.baselinePath, liveSurface);
  return {
    baselinePath: relativeBaselinePath(paths.root, paths.baselinePath),
    liveSurface,
  };
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  if (args.has('--update')) {
    const report = await updateStabilityBaseline();
    printStabilityUpdateReport(report);
    return 0;
  }

  const report = await createStabilityCheckReport();
  printStabilityReport(report);
  return report.status === 'pass' ? 0 : 1;
}

if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    process.exit(await runCli());
  } catch (err) {
    printStabilityError(err);
    process.exit(1);
  }
}
