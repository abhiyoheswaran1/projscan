import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { WorkspaceInfo, WorkspaceKind, WorkspacePackage } from '../types.js';

/**
 * Detect monorepo workspaces. Covers the three setups that account for the
 * vast majority of JS/TS monorepos: npm/yarn workspaces (package.json
 * `workspaces`), pnpm (pnpm-workspace.yaml), and the Nx/Turbo/Lerna fallback
 * (their files exist but they typically piggy-back on package.json
 * workspaces or rely on a `packages/` convention).
 *
 * Returns kind 'none' for non-monorepos. Always includes the workspace root
 * package itself if it has its own package.json with a name.
 */
export async function detectWorkspaces(rootPath: string): Promise<WorkspaceInfo> {
  // Read root package.json (may not exist for Python-only repos).
  const rootPkg = await readPackageJson(path.join(rootPath, 'package.json'));

  // 1) pnpm has its own manifest. Prefer it when present.
  const pnpmManifest = path.join(rootPath, 'pnpm-workspace.yaml');
  if (await fileExists(pnpmManifest)) {
    const patterns = await readPnpmPackages(pnpmManifest);
    const packages = await collectPackages(rootPath, patterns, rootPkg);
    return { kind: 'pnpm', packages, source: 'pnpm-workspace.yaml' };
  }

  // 2) npm / yarn workspaces in package.json.
  if (rootPkg) {
    const patterns = readNpmYarnPatterns(rootPkg);
    if (patterns && patterns.length > 0) {
      const packages = await collectPackages(rootPath, patterns, rootPkg);
      // Distinguish yarn from npm if a yarn.lock is present — affects nothing
      // about discovery, just labelling.
      const kind: WorkspaceKind = (await fileExists(path.join(rootPath, 'yarn.lock')))
        ? 'yarn'
        : 'npm';
      return { kind, packages, source: 'package.json#workspaces' };
    }
  }

  // 3) Lerna — its config has an explicit `packages` field with globs.
  const lernaPath = path.join(rootPath, 'lerna.json');
  if (await fileExists(lernaPath)) {
    const patterns = (await readJsonField<string[]>(lernaPath, 'packages')) ?? ['packages/*'];
    const packages = await collectPackages(rootPath, patterns, rootPkg);
    if (packages.length > 0) {
      return { kind: 'lerna', packages, source: 'lerna.json#packages' };
    }
  }

  // 4) Nx — workspaceLayout supplies appsDir/libsDir; project.json files
  // anywhere identify packages. Older Nx variants used workspace.json (a
  // single file enumerating projects); we read its `projects` map too.
  const nxJsonPath = path.join(rootPath, 'nx.json');
  if (await fileExists(nxJsonPath)) {
    const nxPackages = await collectNxPackages(rootPath, nxJsonPath);
    if (nxPackages.length > 0 || rootPkg) {
      const merged = rootPkg ? [rootPackageOnly(rootPkg), ...nxPackages] : nxPackages;
      merged.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      return { kind: 'nx', packages: merged, source: 'nx.json + project.json scan' };
    }
  }

  // 5) Turbo — turbo.json defines task pipelines, NOT workspace layout.
  // Turbo always rides on top of npm/yarn/pnpm workspaces (handled above).
  // If we get here with a turbo.json but no workspace declaration, treat it
  // as a marker and fall back to the packages/* convention so we still
  // surface something useful.
  if (await fileExists(path.join(rootPath, 'turbo.json'))) {
    const packages = await collectPackages(rootPath, ['packages/*', 'apps/*'], rootPkg);
    if (packages.length > 0) {
      return { kind: 'turbo', packages, source: 'turbo.json (fallback glob)' };
    }
  }

  // Single-package repo (or non-JS).
  return { kind: 'none', packages: rootPkg ? [rootPackageOnly(rootPkg)] : [] };
}

// ── helpers ───────────────────────────────────────────────

interface PackageJson {
  name?: string;
  version?: string;
  workspaces?: string[] | { packages?: string[] };
}

async function readPackageJson(absPath: string): Promise<PackageJson | null> {
  try {
    const raw = await fs.readFile(absPath, 'utf-8');
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

function readNpmYarnPatterns(pkg: PackageJson): string[] | null {
  if (!pkg.workspaces) return null;
  if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
  if (Array.isArray(pkg.workspaces.packages)) return pkg.workspaces.packages;
  return null;
}

async function readPnpmPackages(manifestPath: string): Promise<string[]> {
  // Tiny YAML subset reader: pnpm-workspace.yaml is just `packages:` followed
  // by a YAML list. Avoiding a full YAML dep keeps the install size small.
  let content: string;
  try {
    content = await fs.readFile(manifestPath, 'utf-8');
  } catch {
    return [];
  }
  const patterns: string[] = [];
  const lines = content.split('\n');
  let inPackages = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('packages:')) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      // List item: `  - 'pattern'` or `  - "pattern"` or `  - pattern`.
      const m = /^\s*-\s*['"]?([^'"\n]+?)['"]?\s*$/.exec(line);
      if (m) {
        patterns.push(m[1]);
      } else if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
        // New top-level key — packages section ended.
        inPackages = false;
      }
    }
  }
  return patterns;
}

async function collectPackages(
  rootPath: string,
  patterns: string[],
  rootPkg: PackageJson | null,
): Promise<WorkspacePackage[]> {
  // Each pattern is typically `packages/*`. Resolve to package.json files.
  const pkgManifests = patterns.map((p) => `${trimTrailingSlash(p)}/package.json`);
  const matches = await fg(pkgManifests, {
    cwd: rootPath,
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
  });

  const packages: WorkspacePackage[] = [];

  for (const rel of matches) {
    const abs = path.join(rootPath, rel);
    const pkg = await readPackageJson(abs);
    if (!pkg) continue;
    const dir = path.posix.dirname(rel.split(path.sep).join('/'));
    packages.push({
      name: pkg.name ?? path.posix.basename(dir),
      relativePath: dir,
      version: pkg.version,
      isRoot: false,
    });
  }

  if (rootPkg && rootPkg.name) {
    packages.unshift(rootPackageOnly(rootPkg));
  }

  packages.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return packages;
}

function rootPackageOnly(rootPkg: PackageJson): WorkspacePackage {
  return {
    name: rootPkg.name ?? '<root>',
    relativePath: '',
    version: rootPkg.version,
    isRoot: true,
  };
}

function trimTrailingSlash(p: string): string {
  return p.endsWith('/') ? p.slice(0, -1) : p;
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

/** Read a JSON file and return one named field (or undefined). Best-effort. */
async function readJsonField<T>(absPath: string, field: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(absPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const v = parsed[field];
    return v as T | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Discover Nx workspace packages.
 *
 * Modern Nx (16+) puts a `project.json` next to every project. Older Nx
 * (<= 15) maintains a single `workspace.json` listing them. We try both:
 * scan for project.json files first (covers anything modern), then read
 * workspace.json's `projects` map and treat its directories as packages.
 *
 * `nx.json#workspaceLayout` provides default `appsDir` / `libsDir` hints
 * that we use to scope the project.json scan. When unspecified Nx defaults
 * to "apps" and "libs"; we honor that.
 */
async function collectNxPackages(
  rootPath: string,
  nxJsonPath: string,
): Promise<WorkspacePackage[]> {
  const layout = (await readJsonField<{ appsDir?: string; libsDir?: string }>(
    nxJsonPath,
    'workspaceLayout',
  )) ?? {};
  const appsDir = (layout.appsDir ?? 'apps').replace(/\/+$/, '');
  const libsDir = (layout.libsDir ?? 'libs').replace(/\/+$/, '');

  const found = new Map<string, WorkspacePackage>();

  // 1) Scan for project.json files. Look in the layout dirs first, then in
  // a wider `**/project.json` search bounded by reasonable globs.
  const patterns = Array.from(
    new Set([
      `${appsDir}/**/project.json`,
      `${libsDir}/**/project.json`,
      'packages/**/project.json',
    ]),
  );
  const matches = await fg(patterns, {
    cwd: rootPath,
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
    deep: 4,
  });
  for (const rel of matches) {
    const projectJsonPath = path.join(rootPath, rel);
    const name = (await readJsonField<string>(projectJsonPath, 'name')) ?? path.posix.basename(path.posix.dirname(rel.split(path.sep).join('/')));
    const dir = path.posix.dirname(rel.split(path.sep).join('/'));
    if (!found.has(dir)) {
      found.set(dir, { name, relativePath: dir, isRoot: false });
    }
  }

  // 2) Older Nx: read workspace.json projects map.
  const workspaceJsonPath = path.join(rootPath, 'workspace.json');
  if (await fileExists(workspaceJsonPath)) {
    const projects =
      (await readJsonField<Record<string, string | { root?: string }>>(workspaceJsonPath, 'projects')) ?? {};
    for (const [name, val] of Object.entries(projects)) {
      const root = typeof val === 'string' ? val : val.root;
      if (!root) continue;
      const dir = root.replace(/\/+$/, '');
      if (!found.has(dir)) {
        found.set(dir, { name, relativePath: dir, isRoot: false });
      }
    }
  }

  return [...found.values()];
}

/**
 * Given a file's project-relative path, return the workspace package whose
 * `relativePath` is its longest matching prefix. Used to filter hotspots /
 * coupling rows by --package.
 */
export function findPackageForFile(
  workspaces: WorkspaceInfo,
  filePath: string,
): WorkspacePackage | null {
  let best: WorkspacePackage | null = null;
  for (const pkg of workspaces.packages) {
    if (pkg.isRoot) continue;
    const prefix = pkg.relativePath ? pkg.relativePath + '/' : '';
    if (filePath === pkg.relativePath || filePath.startsWith(prefix)) {
      if (!best || pkg.relativePath.length > best.relativePath.length) best = pkg;
    }
  }
  // Fall back to root package if nothing more specific matched.
  if (!best) {
    const root = workspaces.packages.find((p) => p.isRoot);
    return root ?? null;
  }
  return best;
}

/** Filter helper for callers passing --package <name>. */
export function filterFilesByPackage(
  workspaces: WorkspaceInfo,
  packageName: string,
  files: string[],
): string[] {
  const pkg = workspaces.packages.find((p) => p.name === packageName);
  if (!pkg) return [];
  if (pkg.isRoot) return files;
  const prefix = pkg.relativePath + '/';
  return files.filter((f) => f === pkg.relativePath || f.startsWith(prefix));
}
