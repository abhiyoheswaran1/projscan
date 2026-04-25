import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';
import { buildImportGraph, toPackageName } from '../core/importGraph.js';
import { detectWorkspaces } from '../core/monorepo.js';
import { findDependencyLines } from '../utils/packageJsonLocator.js';

/**
 * Patterns for packages that are typically not imported directly from source
 * but are still legitimately used (plugins, configs, types, peer tooling).
 * Without this allowlist we'd flag everything in devDependencies.
 */
const IMPLICIT_USE_PREFIXES = [
  '@types/',
  'eslint-plugin-',
  'eslint-config-',
  'prettier-plugin-',
  'postcss-plugin-',
  'rollup-plugin-',
  'vite-plugin-',
  'babel-plugin-',
  'babel-preset-',
  'stylelint-plugin-',
  'stylelint-config-',
];

const IMPLICIT_USE_EXACT = new Set([
  'typescript',
  'ts-node',
  'tsx',
  'tsup',
  'esbuild',
  'vite',
  'webpack',
  'rollup',
  'parcel',
  'eslint',
  'prettier',
  'stylelint',
  'husky',
  'lint-staged',
  'commitlint',
  '@commitlint/config-conventional',
  'semantic-release',
  'nx',
  'lerna',
  'rimraf',
  'cross-env',
  'concurrently',
  'nodemon',
  'npm-run-all',
  'only-allow',
  'zx',
  'chokidar',
  'react-scripts',
  'next',
  'nuxt',
  'vitest',
  'jest',
  'mocha',
  'ava',
  'tap',
  'jasmine',
  '@playwright/test',
  'cypress',
  'storybook',
  '@storybook/react',
]);

function isImplicitlyUsed(pkg: string): boolean {
  if (IMPLICIT_USE_EXACT.has(pkg)) return true;
  return IMPLICIT_USE_PREFIXES.some((prefix) => pkg.startsWith(prefix));
}

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  // Build the import graph once across the whole repo. We slice it per-package
  // below for workspace-aware mode.
  const fullGraph = await buildImportGraph(rootPath, files);

  // Workspace detection. When the repo is a single package (kind 'none') or a
  // root-only manifest with no real workspaces, we degrade to the original
  // single-manifest path for full backward compatibility.
  const ws = await detectWorkspaces(rootPath);
  const realWorkspaces = ws.packages.filter((p) => !p.isRoot);
  const isMonorepo = ws.kind !== 'none' && realWorkspaces.length > 0;

  if (!isMonorepo) {
    return await checkOnePackage(rootPath, '', fullGraph, files);
  }

  // Workspace-aware: check the root manifest (if any) AND each workspace package.
  // Each gets its own deps-vs-imports comparison, scoped to the files that
  // belong to that package by longest-prefix path matching.
  const issues: Issue[] = [];
  const rootPkg = ws.packages.find((p) => p.isRoot);
  if (rootPkg) {
    // Root manifest: only consider files NOT under any workspace package dir.
    const claimedPrefixes = realWorkspaces
      .map((p) => p.relativePath)
      .filter((p) => p.length > 0);
    const rootFiles = files.filter(
      (f) => !claimedPrefixes.some((prefix) => f.relativePath.startsWith(prefix + '/')),
    );
    issues.push(...(await checkOnePackage(rootPath, '', fullGraph, rootFiles)));
  }

  for (const wp of realWorkspaces) {
    const pkgDir = path.join(rootPath, wp.relativePath);
    const prefix = wp.relativePath + '/';
    const wpFiles = files.filter((f) => f.relativePath === wp.relativePath || f.relativePath.startsWith(prefix));
    issues.push(...(await checkOnePackage(pkgDir, wp.relativePath, fullGraph, wpFiles)));
  }

  return issues;
}

/**
 * Run the unused-dependency check against one package.json.
 *
 * @param packageDir absolute path to the directory containing package.json.
 * @param locationPrefix path prefix (relative to repo root) used in issue
 *   `locations.file`. Empty string for the repo root; e.g. `packages/foo` for
 *   a workspace package - produces locations like `packages/foo/package.json`.
 * @param fullGraph repo-wide import graph (built once and reused).
 * @param scopedFiles file list this manifest is responsible for. We slice the
 *   global graph down to imports from these files only.
 */
async function checkOnePackage(
  packageDir: string,
  locationPrefix: string,
  fullGraph: Awaited<ReturnType<typeof buildImportGraph>>,
  scopedFiles: FileEntry[],
): Promise<Issue[]> {
  const pkgPath = path.join(packageDir, 'package.json');
  let raw: string;
  try {
    raw = await fs.readFile(pkgPath, 'utf-8');
  } catch {
    return [];
  }
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }

  const dependencies = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDependencies = (pkg.devDependencies ?? {}) as Record<string, string>;
  const allDeclared = new Set([...Object.keys(dependencies), ...Object.keys(devDependencies)]);
  if (allDeclared.size === 0) return [];

  // Project per-package usage: walk only the files this manifest covers and
  // collect their external package names from the full graph's byFile map.
  const usedPackages = new Set<string>();
  for (const f of scopedFiles) {
    const specifiers = fullGraph.byFile.get(f.relativePath);
    if (!specifiers) continue;
    for (const spec of specifiers) {
      const name = toPackageName(spec);
      if (name) usedPackages.add(name);
    }
  }

  const scriptUsedBinaries = extractScriptBinaries(pkg);
  const locations = await findDependencyLines(packageDir);
  const locationFile = locationPrefix ? `${locationPrefix}/package.json` : 'package.json';
  const unused: Issue[] = [];

  for (const name of allDeclared) {
    if (usedPackages.has(name)) continue;
    if (isImplicitlyUsed(name)) continue;
    if (scriptUsedBinaries.has(name)) continue;

    const isDev = name in devDependencies;
    const line = locations?.lineOfDependency.get(name);
    const inWorkspace = locationPrefix ? ` (workspace: ${locationPrefix})` : '';

    unused.push({
      id: locationPrefix ? `unused-dependency-${locationPrefix}-${name}` : `unused-dependency-${name}`,
      title: `Unused ${isDev ? 'dev' : ''} dependency: ${name}${inWorkspace}`.replace('  ', ' ').trim(),
      description: `The package "${name}" is declared in ${locationFile} but never imported from source files under that package. If it's used only in package.json scripts or as a plugin, add it to the projscan allowlist via .projscanrc → disableRules.`,
      severity: isDev ? 'info' : 'warning',
      category: 'dependencies',
      fixAvailable: false,
      locations: locations
        ? [{ file: locationFile, line: line ?? 1 }]
        : undefined,
    });
  }

  return unused;
}

function extractScriptBinaries(pkg: Record<string, unknown>): Set<string> {
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const bins = new Set<string>();
  for (const value of Object.values(scripts)) {
    for (const token of value.split(/[\s&|;]+/)) {
      if (!token) continue;
      if (token.startsWith('-')) continue;
      if (token.includes('/') || token.includes('\\')) continue;
      if (!/^[@\w][\w@\-/]*$/.test(token)) continue;
      bins.add(token);
    }
  }
  return bins;
}
