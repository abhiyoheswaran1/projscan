import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';
import { buildImportGraph } from '../core/importGraph.js';
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
  const pkgPath = path.join(rootPath, 'package.json');
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

  const graph = await buildImportGraph(rootPath, files);

  // Also treat packages invoked from package.json scripts as used.
  // e.g., "build": "tsc" means we should not flag typescript.
  const scriptUsedBinaries = extractScriptBinaries(pkg);

  const locations = await findDependencyLines(rootPath);
  const unused: Issue[] = [];

  for (const name of allDeclared) {
    if (graph.externalPackages.has(name)) continue;
    if (isImplicitlyUsed(name)) continue;
    if (scriptUsedBinaries.has(name)) continue;
    // skip scoped bin lookups (e.g., "npx some-tool") — covered by scriptUsedBinaries

    const isDev = name in devDependencies;
    const line = locations?.lineOfDependency.get(name);

    unused.push({
      id: `unused-dependency-${name}`,
      title: `Unused ${isDev ? 'dev' : ''} dependency: ${name}`.replace('  ', ' ').trim(),
      description: `The package "${name}" is declared in package.json but never imported from source. If it's used only in package.json scripts or as a plugin, add it to the projscan allowlist via .projscanrc → disableRules.`,
      severity: isDev ? 'info' : 'warning',
      category: 'dependencies',
      fixAvailable: false,
      locations: locations
        ? [
            {
              file: 'package.json',
              line: line ?? 1,
            },
          ]
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
