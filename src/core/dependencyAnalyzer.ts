import fs from 'node:fs/promises';
import path from 'node:path';
import type { DependencyReport, DependencyRisk } from '../types.js';
import { detectWorkspaces } from './monorepo.js';

const DEPRECATED_PACKAGES: Record<string, string> = {
  moment: 'Consider using date-fns or dayjs instead',
  request: 'Deprecated - use node-fetch, undici, or axios instead',
  'node-uuid': 'Renamed to uuid',
  nomnom: 'Deprecated - use commander or yargs instead',
  'coffee-script': 'CoffeeScript is no longer maintained',
};

const HEAVY_PACKAGES: Record<string, string> = {
  lodash: 'Consider lodash-es or individual imports (e.g., lodash/get) to reduce bundle size',
  underscore: 'Many utilities are now available as native JS methods',
  jquery: 'Consider using native DOM APIs if possible',
};

export interface DependencyAnalysisOptions {
  /**
   * When provided, return only the workspace package whose name matches.
   * Top-level totals will reflect ONLY that package; `byWorkspace` will have
   * a single entry. Useful for `--package <name>` from CLI/MCP.
   */
  packageFilter?: string;
}

/**
 * Analyze project dependencies. Workspace-aware (0.13.0+): in a monorepo the
 * report aggregates across the root manifest plus every workspace package's
 * manifest, with a `byWorkspace` breakdown. In single-package repos behavior
 * is unchanged - `byWorkspace` is omitted.
 */
export async function analyzeDependencies(
  rootPath: string,
  options: DependencyAnalysisOptions = {},
): Promise<DependencyReport | null> {
  const ws = await detectWorkspaces(rootPath);
  const realWorkspaces = ws.packages.filter((p) => !p.isRoot);
  const isMonorepo = ws.kind !== 'none' && realWorkspaces.length > 0;

  // Single-package: original behavior, no `byWorkspace` field.
  if (!isMonorepo) {
    const one = await analyzeOne(rootPath, undefined);
    if (!one) return null;
    // Project-level risks live with the aggregate, not in analyzeOne.
    if (one.totalDependencies > 0) {
      const hasLock = await checkLockfile(rootPath);
      if (!hasLock) {
        one.risks.push({
          name: 'no-lockfile',
          reason: 'No lockfile found - run npm install to generate package-lock.json',
          severity: 'medium',
        });
      }
    }
    return one;
  }

  // Monorepo: analyze each manifest (root, if present, plus each workspace).
  const rootPkg = ws.packages.find((p) => p.isRoot);
  const manifests: Array<{ dir: string; relativePath: string; name: string; isRoot: boolean }> = [];
  if (rootPkg) {
    manifests.push({
      dir: rootPath,
      relativePath: '',
      name: rootPkg.name,
      isRoot: true,
    });
  }
  for (const wp of realWorkspaces) {
    manifests.push({
      dir: path.join(rootPath, wp.relativePath),
      relativePath: wp.relativePath,
      name: wp.name,
      isRoot: false,
    });
  }

  const filter = options.packageFilter;
  const filtered = filter
    ? manifests.filter((m) => m.name === filter || m.relativePath === filter)
    : manifests;
  if (filter && filtered.length === 0) return null;

  const byWorkspace: NonNullable<DependencyReport['byWorkspace']> = [];
  let totalDeps = 0;
  let totalDevDeps = 0;
  const aggregateDeps: Record<string, string> = {};
  const aggregateDevDeps: Record<string, string> = {};
  const aggregateRisks: DependencyRisk[] = [];

  for (const m of filtered) {
    const one = await analyzeOne(m.dir, m.isRoot ? undefined : m.name);
    if (!one) continue;
    totalDeps += one.totalDependencies;
    totalDevDeps += one.totalDevDependencies;
    Object.assign(aggregateDeps, one.dependencies);
    Object.assign(aggregateDevDeps, one.devDependencies);
    for (const r of one.risks) aggregateRisks.push(r);
    byWorkspace.push({
      workspace: m.name,
      relativePath: m.relativePath,
      isRoot: m.isRoot,
      totalDependencies: one.totalDependencies,
      totalDevDependencies: one.totalDevDependencies,
      risks: one.risks,
    });
  }

  // Re-evaluate aggregate-level risks that need totals across all manifests.
  // The lockfile check is repo-wide, not per-workspace.
  const hasLockfile = await checkLockfile(rootPath);
  if (!hasLockfile && totalDeps > 0) {
    aggregateRisks.push({
      name: 'no-lockfile',
      reason: 'No lockfile found - run npm install to generate package-lock.json',
      severity: 'medium',
    });
  }

  return {
    totalDependencies: totalDeps,
    totalDevDependencies: totalDevDeps,
    dependencies: aggregateDeps,
    devDependencies: aggregateDevDeps,
    risks: aggregateRisks,
    byWorkspace,
  };
}

async function analyzeOne(
  manifestDir: string,
  workspaceName?: string,
): Promise<DependencyReport | null> {
  const pkgPath = path.join(manifestDir, 'package.json');

  let raw: string;
  try {
    raw = await fs.readFile(pkgPath, 'utf-8');
  } catch {
    return null;
  }

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(raw) as typeof pkg;
  } catch {
    return null;
  }

  const dependencies: Record<string, string> = pkg.dependencies ?? {};
  const devDependencies: Record<string, string> = pkg.devDependencies ?? {};
  const risks: DependencyRisk[] = [];

  // Deprecated packages
  for (const [name, reason] of Object.entries(DEPRECATED_PACKAGES)) {
    if (dependencies[name] || devDependencies[name]) {
      risks.push({ name, reason, severity: 'high', workspace: workspaceName });
    }
  }

  // Heavy packages
  for (const [name, reason] of Object.entries(HEAVY_PACKAGES)) {
    if (dependencies[name]) {
      risks.push({ name, reason, severity: 'medium', workspace: workspaceName });
    }
  }

  const totalDeps = Object.keys(dependencies).length;
  if (totalDeps > 100) {
    risks.push({
      name: 'excessive-dependencies',
      reason: `${totalDeps} production dependencies - consider auditing for unused packages`,
      severity: 'high',
      workspace: workspaceName,
    });
  } else if (totalDeps > 50) {
    risks.push({
      name: 'many-dependencies',
      reason: `${totalDeps} production dependencies - review for opportunities to reduce`,
      severity: 'medium',
      workspace: workspaceName,
    });
  }

  // Wildcard version ranges
  for (const [name, version] of Object.entries(dependencies)) {
    if (version === '*' || version.startsWith('>=')) {
      risks.push({
        name,
        reason: `Wildcard version range "${version}" - pin to a specific version for reproducible builds`,
        severity: 'high',
        workspace: workspaceName,
      });
    }
  }

  return {
    totalDependencies: totalDeps,
    totalDevDependencies: Object.keys(devDependencies).length,
    dependencies,
    devDependencies,
    risks,
  };
}

async function checkLockfile(rootPath: string): Promise<boolean> {
  const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  for (const lockfile of lockfiles) {
    try {
      await fs.access(path.join(rootPath, lockfile));
      return true;
    } catch {
      // continue
    }
  }
  return false;
}
