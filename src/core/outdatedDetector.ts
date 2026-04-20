import fs from 'node:fs/promises';
import path from 'node:path';
import type { OutdatedPackage, OutdatedReport } from '../types.js';
import { drift as semverDrift } from '../utils/semver.js';

/**
 * Offline outdated check - compares the version declared in package.json
 * to the version installed under node_modules/<pkg>/package.json.
 *
 * Does not hit the npm registry. `latest` is filled in only when a node_modules
 * install exists; the drift calculation uses installed vs declared.
 */
export async function detectOutdated(rootPath: string): Promise<OutdatedReport> {
  const pkgPath = path.join(rootPath, 'package.json');
  let raw: string;
  try {
    raw = await fs.readFile(pkgPath, 'utf-8');
  } catch {
    return {
      available: false,
      reason: 'No package.json found in this directory',
      totalPackages: 0,
      packages: [],
    };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      available: false,
      reason: 'package.json is not valid JSON',
      totalPackages: 0,
      packages: [],
    };
  }

  const dependencies = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDependencies = (pkg.devDependencies ?? {}) as Record<string, string>;

  const entries: Array<[string, string, 'dependency' | 'devDependency']> = [
    ...Object.entries(dependencies).map(
      ([n, v]) => [n, v, 'dependency'] as [string, string, 'dependency'],
    ),
    ...Object.entries(devDependencies).map(
      ([n, v]) => [n, v, 'devDependency'] as [string, string, 'devDependency'],
    ),
  ];

  const nodeModules = path.join(rootPath, 'node_modules');
  const nodeModulesExists = await pathExists(nodeModules);

  const packages: OutdatedPackage[] = [];
  for (const [name, declared, scope] of entries) {
    let installed: string | null = null;
    if (nodeModulesExists) {
      installed = await readInstalledVersion(nodeModules, name);
    }
    const drift = semverDrift(declared, installed);
    packages.push({
      name,
      declared,
      installed,
      latest: installed, // without registry lookup, installed is the best we know
      drift,
      scope,
    });
  }

  return {
    available: true,
    totalPackages: packages.length,
    packages,
  };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readInstalledVersion(nodeModules: string, name: string): Promise<string | null> {
  const installedPath = path.join(nodeModules, name, 'package.json');
  try {
    const raw = await fs.readFile(installedPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}
