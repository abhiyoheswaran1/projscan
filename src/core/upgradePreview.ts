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

export async function previewUpgrade(
  rootPath: string,
  pkgName: string,
  files: FileEntry[],
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
  const latest = installed; // offline mode: best we know without a registry

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
  };
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
