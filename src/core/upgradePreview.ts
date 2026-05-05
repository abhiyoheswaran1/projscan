import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, UpgradePreview } from '../types.js';
import { drift as semverDrift, parse as parseSemver, compare as compareSemver } from '../utils/semver.js';
import { buildImportGraph, filesImporting } from './importGraph.js';

const CHANGELOG_NAMES = ['CHANGELOG.md', 'CHANGELOG', 'History.md', 'HISTORY.md'];

const BREAKING_MARKERS = [
  /BREAKING\s+CHANGE/i,
  /^#{1,6}.*breaking/im,
  /\*\s*Breaking:/i,
  /deprecat/i,
  /removed\s+support/i,
  /no\s+longer\s+supported/i,
];

// npm package-name grammar: optional scope + name, letters/digits/._-
// No slashes other than the single scope separator. No `..`, no absolute paths.
const PACKAGE_NAME_RE = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;

/**
 * Validate a package name against the npm grammar before any filesystem
 * operation. Rejects traversal (`..`), absolute paths, backslashes, spaces,
 * and any other shape that could escape node_modules/<name>/.
 *
 * This is security-critical: `previewUpgrade` is exposed via MCP
 * (`projscan_upgrade`) where the argument comes from AI agents that can be
 * influenced by untrusted content. A name containing `../` would otherwise
 * escape node_modules and return arbitrary CHANGELOG / package.json contents
 * to the caller.
 */
export function isValidPackageName(name: string): boolean {
  if (typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 214) return false;
  if (name !== name.trim()) return false;
  if (name.includes('..')) return false;
  if (name.includes('\\')) return false;
  return PACKAGE_NAME_RE.test(name);
}

export interface PreviewUpgradeOptions {
  /**
   * 1.3+ — when true, fetch the actual latest version from the npm
   * registry. Default false; the offline path uses `installed` as a
   * stand-in for `latest`. Behind an explicit flag because every other
   * code path in projscan is offline and we want that posture preserved
   * by default.
   */
  checkRegistry?: boolean;
  /** Registry URL override — defaults to https://registry.npmjs.org. */
  registryUrl?: string;
  /** Network timeout in ms. Default 5000. */
  fetchTimeoutMs?: number;
}

export async function previewUpgrade(
  rootPath: string,
  pkgName: string,
  files: FileEntry[],
  options: PreviewUpgradeOptions = {},
): Promise<UpgradePreview> {
  if (!isValidPackageName(pkgName)) {
    return {
      available: false,
      reason: `Invalid package name: "${pkgName}". Must match the npm package-name grammar.`,
      name: pkgName,
      declared: null,
      installed: null,
      latest: null,
      drift: 'unknown',
      breakingMarkers: [],
      importers: [],
    };
  }

  const declaredVersions = await readDeclaredVersion(rootPath, pkgName);
  const installed = await readInstalledVersion(rootPath, pkgName);
  // Offline default: `latest = installed`. With --check-registry, hit npm
  // and replace with the registry's view.
  let latest = installed;
  let registryError: string | undefined;
  if (options.checkRegistry) {
    const fetched = await fetchLatestFromRegistry(pkgName, options);
    if (fetched.ok) {
      latest = fetched.version;
    } else {
      registryError = fetched.error;
    }
  }

  if (!declaredVersions && !installed) {
    return {
      available: false,
      reason: `Package "${pkgName}" not found in package.json or node_modules`,
      name: pkgName,
      declared: null,
      installed: null,
      latest: null,
      drift: 'unknown',
      breakingMarkers: [],
      importers: [],
    };
  }

  if (!installed) {
    return {
      available: false,
      reason: `Package "${pkgName}" not installed - run npm install and retry`,
      name: pkgName,
      declared: declaredVersions,
      installed: null,
      latest: null,
      drift: 'unknown',
      breakingMarkers: [],
      importers: [],
    };
  }

  const drift = semverDrift(declaredVersions, installed);

  let changelog: string | undefined;
  let breakingMarkers: string[] = [];
  try {
    changelog = await readChangelog(rootPath, pkgName);
    if (changelog) {
      const slice = sliceBetween(changelog, declaredVersions, installed);
      breakingMarkers = detectBreakingMarkers(slice);
      changelog = truncate(slice, 4000);
    }
  } catch {
    // ignore
  }

  const graph = await buildImportGraph(rootPath, files);
  const importers = filesImporting(graph, pkgName);

  const latestSource: 'registry' | 'installed' | undefined = options.checkRegistry
    ? registryError
      ? 'installed'
      : 'registry'
    : undefined;

  return {
    available: true,
    name: pkgName,
    declared: declaredVersions,
    installed,
    latest,
    drift,
    breakingMarkers,
    changelogExcerpt: changelog,
    importers,
    ...(latestSource ? { latestSource } : {}),
    ...(registryError ? { registryError } : {}),
  };
}

/**
 * Fetch the latest version of `pkgName` from the npm registry. Uses
 * Node's built-in fetch (Node 18+). Network-only; the caller must have
 * opted in via `checkRegistry: true`.
 *
 * Returns `{ ok: true, version }` on success or `{ ok: false, error }` on
 * timeout / non-2xx / network error. Failures are non-fatal — the offline
 * `latest = installed` fallback still produces a valid preview.
 */
async function fetchLatestFromRegistry(
  pkgName: string,
  options: PreviewUpgradeOptions,
): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  const registry = (options.registryUrl ?? 'https://registry.npmjs.org').replace(/\/+$/, '');
  // npm encodes the scope's `/` as `%2F` for the abbreviated metadata path.
  const encoded = pkgName.startsWith('@') ? pkgName.replace('/', '%2F') : pkgName;
  const url = `${registry}/${encoded}/latest`;
  const timeoutMs = options.fetchTimeoutMs ?? 5000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, error: `registry returned HTTP ${res.status}` };
    }
    const body = (await res.json()) as { version?: unknown };
    if (typeof body.version !== 'string') {
      return { ok: false, error: 'registry response missing "version" field' };
    }
    return { ok: true, version: body.version };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `registry fetch failed: ${msg.slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }
}

async function readDeclaredVersion(rootPath: string, name: string): Promise<string | null> {
  const pkgPath = path.join(rootPath, 'package.json');
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return (
      pkg.dependencies?.[name] ??
      pkg.devDependencies?.[name] ??
      pkg.peerDependencies?.[name] ??
      null
    );
  } catch {
    return null;
  }
}

async function readInstalledVersion(rootPath: string, name: string): Promise<string | null> {
  const nodeModules = path.resolve(rootPath, 'node_modules');
  const pkgDir = path.resolve(nodeModules, name);
  if (!isInside(pkgDir, nodeModules)) return null;
  const p = path.join(pkgDir, 'package.json');
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

async function readChangelog(rootPath: string, name: string): Promise<string | undefined> {
  const nodeModules = path.resolve(rootPath, 'node_modules');
  const base = path.resolve(nodeModules, name);
  if (!isInside(base, nodeModules)) return undefined;
  for (const filename of CHANGELOG_NAMES) {
    const p = path.join(base, filename);
    try {
      return await fs.readFile(p, 'utf-8');
    } catch {
      // try next
    }
  }
  return undefined;
}

/** True iff `candidate` resolves to `parent` itself or a path inside `parent`. */
function isInside(candidate: string, parent: string): boolean {
  const rel = path.relative(parent, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Extract the CHANGELOG section strictly *between* two versions (exclusive of
 * the lower version's body, inclusive up to the upper version). If we can't
 * locate headings, return the top 100 lines.
 */
function sliceBetween(changelog: string, from: string | null, to: string | null): string {
  const fromParsed = from ? parseSemver(from) : null;
  const toParsed = to ? parseSemver(to) : null;

  const lines = changelog.split('\n');
  const versionHeadingRe = /^#{1,3}\s*(?:\[?v?(\d+\.\d+\.\d+)(?:[-+][^\]\s]+)?]?)/;

  let startIdx = 0;
  let endIdx = Math.min(lines.length, 200);

  if (toParsed) {
    for (let i = 0; i < lines.length; i++) {
      const m = versionHeadingRe.exec(lines[i]);
      if (!m) continue;
      const v = parseSemver(m[1]);
      if (!v) continue;
      if (compareSemver(m[1], to!) === 0) {
        startIdx = i;
        break;
      }
    }
  }

  if (fromParsed) {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const m = versionHeadingRe.exec(lines[i]);
      if (!m) continue;
      const v = parseSemver(m[1]);
      if (!v) continue;
      if (compareSemver(m[1], from!) <= 0) {
        endIdx = i;
        break;
      }
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim();
}

function detectBreakingMarkers(text: string): string[] {
  const markers: string[] = [];
  for (const re of BREAKING_MARKERS) {
    const m = re.exec(text);
    if (m) {
      markers.push(m[0].slice(0, 120));
    }
  }
  return [...new Set(markers)];
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n… (truncated)';
}
