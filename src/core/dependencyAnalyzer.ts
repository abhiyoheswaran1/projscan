import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  DependencyLicenseEntry,
  DependencyLicenseSummary,
  DependencyReport,
  DependencyRisk,
  DependencySizeEntry,
  DependencySizeSummary,
} from '../types.js';
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
  const aggregateLicenseEntries: DependencyLicenseEntry[] = [];
  const aggregateSizeEntries: DependencySizeEntry[] = [];

  for (const m of filtered) {
    const one = await analyzeOne(m.dir, m.isRoot ? undefined : m.name);
    if (!one) continue;
    totalDeps += one.totalDependencies;
    totalDevDeps += one.totalDevDependencies;
    Object.assign(aggregateDeps, one.dependencies);
    Object.assign(aggregateDevDeps, one.devDependencies);
    for (const r of one.risks) aggregateRisks.push(r);
    if (one.licenses) aggregateLicenseEntries.push(...one.licenses.packages);
    if (one.sizes) aggregateSizeEntries.push(...one.sizes.packages);
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
  const licenses = summarizeLicenses(aggregateLicenseEntries);
  const sizes = summarizeSizes(aggregateSizeEntries);

  return {
    totalDependencies: totalDeps,
    totalDevDependencies: totalDevDeps,
    dependencies: aggregateDeps,
    devDependencies: aggregateDevDeps,
    risks: aggregateRisks,
    licenses,
    sizes,
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
  const licenses = await collectLicenses(manifestDir, dependencies, devDependencies, workspaceName);
  const sizes = await collectSizes(manifestDir, dependencies, devDependencies, workspaceName);

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
  for (const entry of licenses.copyleft) {
    risks.push({
      name: entry.name,
      reason: `Copyleft license ${entry.license ?? 'UNKNOWN'} detected - review policy before merge or third-party notice generation`,
      severity: 'high',
      workspace: workspaceName,
    });
  }
  return {
    totalDependencies: totalDeps,
    totalDevDependencies: Object.keys(devDependencies).length,
    dependencies,
    devDependencies,
    risks,
    licenses,
    sizes,
  };
}

async function collectLicenses(
  manifestDir: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  workspaceName?: string,
): Promise<DependencyLicenseSummary> {
  const entries: DependencyLicenseEntry[] = [];
  for (const [name, version] of Object.entries(dependencies)) {
    entries.push(await licenseEntry(manifestDir, name, version, 'production', workspaceName));
  }
  for (const [name, version] of Object.entries(devDependencies)) {
    entries.push(await licenseEntry(manifestDir, name, version, 'development', workspaceName));
  }
  return summarizeLicenses(entries);
}

async function collectSizes(
  manifestDir: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  workspaceName?: string,
): Promise<DependencySizeSummary> {
  const entries: DependencySizeEntry[] = [];
  for (const [name, version] of Object.entries(dependencies)) {
    entries.push(await sizeEntry(manifestDir, name, version, 'production', workspaceName));
  }
  for (const [name, version] of Object.entries(devDependencies)) {
    entries.push(await sizeEntry(manifestDir, name, version, 'development', workspaceName));
  }
  return summarizeSizes(entries);
}

async function licenseEntry(
  manifestDir: string,
  name: string,
  version: string,
  scope: DependencyLicenseEntry['scope'],
  workspaceName?: string,
): Promise<DependencyLicenseEntry> {
  const metadata = await readInstalledPackageMetadata(manifestDir, name);
  const license = normalizeLicense(metadata?.license);
  return {
    name,
    version,
    scope,
    license,
    ...(workspaceName ? { workspace: workspaceName } : {}),
  };
}

async function sizeEntry(
  manifestDir: string,
  name: string,
  version: string,
  scope: DependencySizeEntry['scope'],
  workspaceName?: string,
): Promise<DependencySizeEntry> {
  const bytes = await installedPackageSize(manifestDir, name);
  return {
    name,
    version,
    scope,
    bytes,
    formatted: bytes === null ? 'not installed' : formatBytes(bytes),
    installed: bytes !== null,
    ...(workspaceName ? { workspace: workspaceName } : {}),
  };
}

async function readInstalledPackageMetadata(
  manifestDir: string,
  name: string,
): Promise<{ license?: unknown } | null> {
  const packageJson = path.join(installedPackagePath(manifestDir, name), 'package.json');
  try {
    const raw = await fs.readFile(packageJson, 'utf-8');
    return JSON.parse(raw) as { license?: unknown };
  } catch {
    return null;
  }
}

async function installedPackageSize(manifestDir: string, name: string): Promise<number | null> {
  const packageDir = installedPackagePath(manifestDir, name);
  return directorySize(packageDir);
}

function installedPackagePath(manifestDir: string, name: string): string {
  return path.join(manifestDir, 'node_modules', ...name.split('/'));
}

async function directorySize(dir: string): Promise<number | null> {
  let total = 0;
  const stack = [dir];
  try {
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        const stat = await fs.lstat(fullPath);
        total += stat.size;
      }
    }
    return total;
  } catch {
    return null;
  }
}

function normalizeLicense(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (value && typeof value === 'object' && 'type' in value) {
    const typed = (value as { type?: unknown }).type;
    if (typeof typed === 'string' && typed.trim().length > 0) return typed.trim();
  }
  return null;
}

function summarizeLicenses(entries: DependencyLicenseEntry[]): DependencyLicenseSummary {
  const byLicense: Record<string, number> = {};
  const unknown: string[] = [];
  const copyleft: DependencyLicenseEntry[] = [];
  const noticeCandidates: DependencyLicenseEntry[] = [];
  for (const entry of entries) {
    const license = entry.license ?? 'UNKNOWN';
    byLicense[license] = (byLicense[license] ?? 0) + 1;
    if (entry.license === null) {
      unknown.push(entry.name);
    } else {
      noticeCandidates.push(entry);
      if (isCopyleftLicense(entry.license)) copyleft.push(entry);
    }
  }
  return {
    packages: entries.sort((a, b) => a.name.localeCompare(b.name)),
    byLicense: Object.fromEntries(Object.entries(byLicense).sort(([a], [b]) => a.localeCompare(b))),
    unknown: unknown.sort((a, b) => a.localeCompare(b)),
    copyleft: copyleft.sort((a, b) => a.name.localeCompare(b.name)),
    noticeCandidates: noticeCandidates.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function summarizeSizes(entries: DependencySizeEntry[]): DependencySizeSummary {
  const installed = entries.filter((entry) => entry.bytes !== null);
  const totalBytes = installed.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);
  const packages = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const largest = [...installed]
    .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 10);
  return {
    packages,
    largest,
    totalBytes,
    formattedTotal: formatBytes(totalBytes),
    missing: entries
      .filter((entry) => !entry.installed)
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b)),
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  for (let index = 0; index < units.length; index += 1) {
    if (value < 1024 || index === units.length - 1) return `${value.toFixed(1)} ${units[index]}`;
    value /= 1024;
  }
  return `${bytes} B`;
}

function isCopyleftLicense(license: string): boolean {
  return /\b(?:AGPL|GPL|LGPL|SSPL)\b/i.test(license);
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
