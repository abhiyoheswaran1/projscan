import fs from 'node:fs/promises';
import path from 'node:path';
import { detectWorkspaces } from './monorepo.js';
import {
  readEntrypointFiles,
  type ReviewPublicSurfaceManifest,
} from './reviewPublicSurface.js';
import type { ReviewDependencyChange } from '../types/review.js';

type DependencyKind = 'dep' | 'dev';
type DependencyMap = Record<string, string>;
type DependencyChangeBuckets = Pick<ReviewDependencyChange, 'added' | 'removed' | 'bumped'>;

export interface ManifestSnapshot extends ReviewPublicSurfaceManifest {
  workspace: string;
  manifestFile: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  entrypoints: Record<string, string>;
}

export async function readManifests(rootPath: string): Promise<Map<string, ManifestSnapshot>> {
  const ws = await detectWorkspaces(rootPath);
  const out = new Map<string, ManifestSnapshot>();
  const all = ws.kind === 'none' ? [] : ws.packages;
  if (all.length === 0) {
    const root = await readOneManifest(rootPath, 'package.json', '');
    if (root) out.set('package.json', root);
    return out;
  }
  for (const p of all) {
    const manifestRel = p.relativePath ? `${p.relativePath}/package.json` : 'package.json';
    const dir = path.join(rootPath, p.relativePath);
    const m = await readOneManifest(dir, manifestRel, p.name);
    if (m) out.set(manifestRel, m);
  }
  return out;
}

async function readOneManifest(
  dir: string,
  manifestFile: string,
  workspaceName: string,
): Promise<ManifestSnapshot | null> {
  const p = path.join(dir, 'package.json');
  let raw: string;
  try {
    raw = await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
  let parsed: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    main?: unknown;
    module?: unknown;
    types?: unknown;
    exports?: unknown;
    bin?: unknown;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return null;
  }
  const entrypoints = readEntrypoints(parsed);
  return {
    workspace: workspaceName,
    manifestFile,
    dependencies: parsed.dependencies ?? {},
    devDependencies: parsed.devDependencies ?? {},
    entrypoints,
    entrypointFiles: readEntrypointFiles(parsed),
  };
}

function readEntrypoints(parsed: {
  main?: unknown;
  module?: unknown;
  types?: unknown;
  exports?: unknown;
  bin?: unknown;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of ['main', 'module', 'types', 'exports', 'bin'] as const) {
    const value = parsed[field];
    if (value === undefined) continue;
    out[field] = entrypointValue(value);
  }
  return out;
}

function entrypointValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function diffManifests(
  base: Map<string, ManifestSnapshot>,
  head: Map<string, ManifestSnapshot>,
): ReviewDependencyChange[] {
  const out: ReviewDependencyChange[] = [];
  const allManifests = new Set<string>([...base.keys(), ...head.keys()]);
  for (const manifestFile of allManifests) {
    const b = base.get(manifestFile);
    const h = head.get(manifestFile);
    if (!b && !h) continue;
    const change = diffOneManifest(b, h, manifestFile);
    if (change.added.length || change.removed.length || change.bumped.length) {
      out.push(change);
    }
  }
  out.sort((a, b) => a.manifestFile.localeCompare(b.manifestFile));
  return out;
}

function diffOneManifest(
  base: ManifestSnapshot | undefined,
  head: ManifestSnapshot | undefined,
  manifestFile: string,
): ReviewDependencyChange {
  const workspace = head?.workspace ?? base?.workspace ?? '';
  const changes = emptyDependencyChangeBuckets();
  collectDependencyChanges('dep', base?.dependencies ?? {}, head?.dependencies ?? {}, changes);
  collectDependencyChanges(
    'dev',
    base?.devDependencies ?? {},
    head?.devDependencies ?? {},
    changes,
  );
  sortDependencyChangeBuckets(changes);
  return { workspace, manifestFile, ...changes };
}

function emptyDependencyChangeBuckets(): DependencyChangeBuckets {
  return { added: [], removed: [], bumped: [] };
}

function collectDependencyChanges(
  kind: DependencyKind,
  base: DependencyMap,
  head: DependencyMap,
  changes: DependencyChangeBuckets,
): void {
  appendAddedAndBumpedDependencies(kind, base, head, changes);
  appendRemovedDependencies(kind, base, head, changes);
}

function appendAddedAndBumpedDependencies(
  kind: DependencyKind,
  base: DependencyMap,
  head: DependencyMap,
  changes: DependencyChangeBuckets,
): void {
  for (const [name, version] of Object.entries(head)) {
    if (!(name in base)) {
      changes.added.push({ name, version, kind });
      continue;
    }
    if (base[name] !== version) {
      changes.bumped.push({ name, from: base[name], to: version, kind });
    }
  }
}

function appendRemovedDependencies(
  kind: DependencyKind,
  base: DependencyMap,
  head: DependencyMap,
  changes: DependencyChangeBuckets,
): void {
  for (const [name, version] of Object.entries(base)) {
    if (!(name in head)) changes.removed.push({ name, version, kind });
  }
}

function sortDependencyChangeBuckets(changes: DependencyChangeBuckets): void {
  changes.added.sort(sortDependencyName);
  changes.removed.sort(sortDependencyName);
  changes.bumped.sort(sortDependencyName);
}

function sortDependencyName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

export function scopeDependencyChanges(
  changes: ReviewDependencyChange[],
  packageName: string | undefined,
): ReviewDependencyChange[] {
  if (!packageName) return changes;
  return changes.filter((change) => change.workspace === packageName);
}
