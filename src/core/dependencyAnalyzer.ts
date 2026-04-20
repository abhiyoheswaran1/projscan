import fs from 'node:fs/promises';
import path from 'node:path';
import type { DependencyReport, DependencyRisk } from '../types.js';

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

export async function analyzeDependencies(rootPath: string): Promise<DependencyReport | null> {
  const pkgPath = path.join(rootPath, 'package.json');

  let raw: string;
  try {
    raw = await fs.readFile(pkgPath, 'utf-8');
  } catch {
    return null;
  }

  const pkg = JSON.parse(raw);
  const dependencies: Record<string, string> = pkg.dependencies ?? {};
  const devDependencies: Record<string, string> = pkg.devDependencies ?? {};

  const risks: DependencyRisk[] = [];

  // Check for deprecated packages
  for (const [name, reason] of Object.entries(DEPRECATED_PACKAGES)) {
    if (dependencies[name] || devDependencies[name]) {
      risks.push({ name, reason, severity: 'high' });
    }
  }

  // Check for heavy packages
  for (const [name, reason] of Object.entries(HEAVY_PACKAGES)) {
    if (dependencies[name]) {
      risks.push({ name, reason, severity: 'medium' });
    }
  }

  // Check for excessive dependencies
  const totalDeps = Object.keys(dependencies).length;
  if (totalDeps > 100) {
    risks.push({
      name: 'excessive-dependencies',
      reason: `${totalDeps} production dependencies - consider auditing for unused packages`,
      severity: 'high',
    });
  } else if (totalDeps > 50) {
    risks.push({
      name: 'many-dependencies',
      reason: `${totalDeps} production dependencies - review for opportunities to reduce`,
      severity: 'medium',
    });
  }

  // Check for wildcard version ranges
  for (const [name, version] of Object.entries(dependencies)) {
    if (version === '*' || version.startsWith('>=')) {
      risks.push({
        name,
        reason: `Wildcard version range "${version}" - pin to a specific version for reproducible builds`,
        severity: 'high',
      });
    }
  }

  // Check for missing lockfile
  const hasLockfile = await checkLockfile(rootPath);
  if (!hasLockfile && totalDeps > 0) {
    risks.push({
      name: 'no-lockfile',
      reason: 'No lockfile found - run npm install to generate package-lock.json',
      severity: 'medium',
    });
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
