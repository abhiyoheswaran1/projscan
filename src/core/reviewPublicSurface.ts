import path from 'node:path';
import type { CodeGraph } from './codeGraph.js';

export interface ReviewPublicSurfaceManifest {
  manifestFile: string;
  entrypointFiles: string[];
}

export function readEntrypointFiles(parsed: {
  main?: unknown;
  module?: unknown;
  types?: unknown;
  exports?: unknown;
  bin?: unknown;
}): string[] {
  const out = new Set<string>();
  for (const field of ['main', 'module', 'types', 'exports', 'bin'] as const) {
    collectEntrypointFiles(parsed[field], out);
  }
  return [...out].sort();
}

export function buildPublicExportFileSet(
  baseManifests: Iterable<ReviewPublicSurfaceManifest>,
  headManifests: Iterable<ReviewPublicSurfaceManifest>,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
): Set<string> {
  const publicFiles = new Set<string>();
  for (const manifest of [...baseManifests, ...headManifests]) {
    for (const entrypoint of manifest.entrypointFiles) {
      for (const candidate of publicEntrypointCandidates(manifest.manifestFile, entrypoint)) {
        publicFiles.add(candidate);
      }
    }
  }
  return expandReexportedPublicFiles(publicFiles, baseGraph, headGraph);
}

function collectEntrypointFiles(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    const normalized = normalizeRelativeEntrypoint(value);
    if (normalized) out.add(normalized);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectEntrypointFiles(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const item of Object.values(value as Record<string, unknown>)) {
    collectEntrypointFiles(item, out);
  }
}

function normalizeRelativeEntrypoint(value: string): string | null {
  if (value.startsWith('/')) return null;
  const withoutPrefix = value.replace(/^\.\//, '');
  if (!withoutPrefix || withoutPrefix.startsWith('..')) return null;
  if (!value.startsWith('./') && !looksLikeEntrypointPath(withoutPrefix)) return null;
  return path.posix.normalize(withoutPrefix);
}

function looksLikeEntrypointPath(value: string): boolean {
  return value.includes('/') || /\.[cm]?[jt]sx?$/.test(value) || value.endsWith('.d.ts');
}

function publicEntrypointCandidates(manifestFile: string, entrypoint: string): string[] {
  const manifestDir = path.posix.dirname(manifestFile);
  const packageDir = manifestDir === '.' ? '' : manifestDir;
  const target = packageDir ? path.posix.join(packageDir, entrypoint) : entrypoint;
  const candidates = new Set<string>([target]);
  const sourceTarget = toSourceEntrypoint(target);
  candidates.add(sourceTarget);
  for (const file of [target, sourceTarget]) {
    for (const variant of sourceExtensionVariants(file)) candidates.add(variant);
  }
  return [...candidates];
}

function toSourceEntrypoint(file: string): string {
  if (file.startsWith('dist/')) return `src/${file.slice('dist/'.length)}`;
  return file.replace('/dist/', '/src/');
}

function sourceExtensionVariants(file: string): string[] {
  if (file.endsWith('.d.ts')) {
    const stem = file.slice(0, -5);
    return [file, `${stem}.ts`, `${stem}.tsx`];
  }
  const ext = path.posix.extname(file);
  if (!ext) return [];
  const stem = file.slice(0, -ext.length);
  return [file, `${stem}.ts`, `${stem}.tsx`, `${stem}.js`, `${stem}.jsx`];
}

function expandReexportedPublicFiles(
  directPublicFiles: Set<string>,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
): Set<string> {
  const out = new Set(directPublicFiles);
  addReexportedPublicFiles(out, directPublicFiles, baseGraph);
  addReexportedPublicFiles(out, directPublicFiles, headGraph);
  return out;
}

function addReexportedPublicFiles(
  out: Set<string>,
  directPublicFiles: Set<string>,
  graph: CodeGraph,
): void {
  const queue = [...directPublicFiles].filter((file) => graph.files.has(file));
  const seen = new Set<string>();
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const target of reexportTargets(file, graph)) {
      if (out.has(target)) continue;
      out.add(target);
      queue.push(target);
    }
  }
}

function reexportTargets(file: string, graph: CodeGraph): string[] {
  const targets: string[] = [];
  const entry = graph.files.get(file);
  for (const imp of entry?.imports ?? []) {
    if (imp.kind !== 'reexport' || imp.typeOnly) continue;
    const target = resolveRelativeGraphImport(file, imp.source, graph);
    if (target) targets.push(target);
  }
  return targets;
}

function resolveRelativeGraphImport(
  importingFile: string,
  source: string,
  graph: CodeGraph,
): string | null {
  if (!source.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importingFile), source));
  for (const candidate of graphImportCandidates(base)) {
    if (graph.files.has(candidate)) return candidate;
  }
  return null;
}

function graphImportCandidates(base: string): string[] {
  const candidates = new Set<string>([base, ...sourceExtensionVariants(base)]);
  if (!path.posix.extname(base)) {
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      candidates.add(`${base}${ext}`);
      candidates.add(`${base}/index${ext}`);
    }
  }
  return [...candidates];
}
