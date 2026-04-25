import fs from 'node:fs/promises';
import path from 'node:path';
import type { OutdatedPackage, OutdatedReport, WorkspaceInfo } from '../types.js';
import { drift as semverDrift } from '../utils/semver.js';

export interface OutdatedOptions {
  /** When provided, scan each workspace package's package.json individually. */
  workspaces?: WorkspaceInfo;
  /** When provided alongside workspaces, restrict to a single package by name. */
  workspaceFilter?: string;
}

/**
 * Offline outdated check - compares the version declared in package.json
 * to the version installed under node_modules/<pkg>/package.json.
 *
 * In a monorepo (caller supplies workspaces), each package's package.json is
 * scanned. Each result entry carries the workspace it came from. Installed
 * versions still resolve through the root node_modules (npm/yarn/pnpm hoisting
 * makes that the right place to look in 95% of installs).
 *
 * Does not hit the npm registry. `latest` is filled in only when a node_modules
 * install exists; the drift calculation uses installed vs declared.
 */
export async function detectOutdated(
  rootPath: string,
  options: OutdatedOptions = {},
): Promise<OutdatedReport> {
  const ws = options.workspaces;
  const isMonorepo =
    ws !== undefined && ws.kind !== 'none' && ws.packages.length > 1;

  if (!isMonorepo) {
    // Single-package path: read root package.json only.
    return await scanSinglePackage(rootPath, undefined);
  }

  // Monorepo path: scan each package's manifest, attribute results.
  const nodeModules = path.join(rootPath, 'node_modules');
  const nodeModulesExists = await pathExists(nodeModules);

  const allPackages: OutdatedPackage[] = [];
  const byWorkspace: Array<{ workspace: string; relativePath: string; total: number }> = [];

  for (const wp of ws!.packages) {
    if (options.workspaceFilter && wp.name !== options.workspaceFilter) continue;
    const pkgDir = wp.relativePath ? path.join(rootPath, wp.relativePath) : rootPath;
    const pkgManifest = path.join(pkgDir, 'package.json');
    const pkgEntries = await readManifestEntries(pkgManifest);
    const pkgResults: OutdatedPackage[] = [];
    for (const [name, declared, scope] of pkgEntries) {
      let installed: string | null = null;
      if (nodeModulesExists) installed = await readInstalledVersion(nodeModules, name);
      pkgResults.push({
        name,
        declared,
        installed,
        latest: installed,
        drift: semverDrift(declared, installed),
        scope,
        workspace: wp.name,
      });
    }
    allPackages.push(...pkgResults);
    byWorkspace.push({ workspace: wp.name, relativePath: wp.relativePath, total: pkgResults.length });
  }

  return {
    available: true,
    totalPackages: allPackages.length,
    packages: allPackages,
    byWorkspace,
  };
}

async function scanSinglePackage(
  rootPath: string,
  workspaceName: string | undefined,
): Promise<OutdatedReport> {
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
  let pkgJson: Record<string, unknown>;
  try {
    pkgJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      available: false,
      reason: 'package.json is not valid JSON',
      totalPackages: 0,
      packages: [],
    };
  }
  const entries = manifestEntriesFromParsed(pkgJson);

  const nodeModules = path.join(rootPath, 'node_modules');
  const nodeModulesExists = await pathExists(nodeModules);

  const packages: OutdatedPackage[] = [];
  for (const [name, declared, scope] of entries) {
    let installed: string | null = null;
    if (nodeModulesExists) installed = await readInstalledVersion(nodeModules, name);
    const entry: OutdatedPackage = {
      name,
      declared,
      installed,
      latest: installed,
      drift: semverDrift(declared, installed),
      scope,
    };
    if (workspaceName) entry.workspace = workspaceName;
    packages.push(entry);
  }

  return {
    available: true,
    totalPackages: packages.length,
    packages,
  };
}

type ManifestEntry = [string, string, 'dependency' | 'devDependency'];

function manifestEntriesFromParsed(pkg: Record<string, unknown>): ManifestEntry[] {
  const dependencies = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDependencies = (pkg.devDependencies ?? {}) as Record<string, string>;
  return [
    ...Object.entries(dependencies).map(
      ([n, v]) => [n, v, 'dependency'] as ManifestEntry,
    ),
    ...Object.entries(devDependencies).map(
      ([n, v]) => [n, v, 'devDependency'] as ManifestEntry,
    ),
  ];
}

/** Read deps/devDeps from a package.json. Returns [] if file unreadable/invalid (used in monorepo iteration where one bad workspace shouldn't fail the whole scan). */
async function readManifestEntries(pkgPath: string): Promise<ManifestEntry[]> {
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
  return manifestEntriesFromParsed(pkg);
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
