import path from 'node:path';
import type { FileEntry } from '../types.js';
import type { AstImport, AstExport } from './ast.js';
import { getAdapterFor, listAdapters } from './languages/registry.js';
import type { LanguageAdapter, LanguageResolveContext } from './languages/LanguageAdapter.js';
import { mapWithConcurrency, DEFAULT_FILE_IO_CONCURRENCY } from '../utils/concurrency.js';
import { computeFanIn, computeFanOut } from './codeGraphFanMetrics.js';
import { rebuildCrossFileIndexes } from './codeGraphIndexes.js';
import { parseFileToGraphEntry, processChangedPath } from './codeGraphParsing.js';
import { expandLocalStarReexports, isLocalStarReexport } from './codeGraphReexports.js';
import type { CodeGraph, GraphFile } from './codeGraphTypes.js';

export type { CodeGraph, GraphFile };

const MAX_FILE_SIZE = 1024 * 1024;

export async function buildCodeGraph(
  rootPath: string,
  files: FileEntry[],
  previousGraph?: CodeGraph,
): Promise<CodeGraph> {
  const contextByAdapter = await prepareAdapterContexts(rootPath, files);
  const parseable = files
    .map((f) => ({ file: f, adapter: getAdapterFor(f.relativePath) }))
    .filter(
      (x): x is { file: FileEntry; adapter: LanguageAdapter } =>
        !!x.adapter && x.file.sizeBytes <= (x.adapter.maxFileSize ?? MAX_FILE_SIZE),
    );

  const graphFiles = new Map<string, GraphFile>();
  // Bound concurrency. Without this, a 10K-file repo would issue 10K
  // concurrent fs.stat + fs.readFile + adapter.parse, far exceeding macOS's
  // default 256 open-files ulimit and tripping EMFILE on cold scans.
  await mapWithConcurrency(parseable, DEFAULT_FILE_IO_CONCURRENCY, async ({ file, adapter }) => {
    const entry = await parseFileToGraphEntry(rootPath, file, adapter, previousGraph);
    if (entry) graphFiles.set(file.relativePath, entry);
  });

  expandLocalStarReexports(graphFiles, contextByAdapter);
  const { localImporters, packageImporters, symbolDefs } = rebuildCrossFileIndexes(
    graphFiles,
    contextByAdapter,
  );
  computeFanIn(graphFiles);
  computeFanOut(graphFiles);

  return {
    files: graphFiles,
    packageImporters,
    localImporters,
    symbolDefs,
    scannedFiles: graphFiles.size,
  };
}

/**
 * Per-adapter setup (e.g. Python package-root detection from
 * pyproject.toml, Rust workspace detection from Cargo.toml). Run once
 * per graph build; cheap relative to parsing.
 */
async function prepareAdapterContexts(
  rootPath: string,
  files: FileEntry[],
): Promise<Map<LanguageAdapter, LanguageResolveContext>> {
  const contextByAdapter = new Map<LanguageAdapter, LanguageResolveContext>();
  for (const adapter of listAdapters()) {
    contextByAdapter.set(adapter, await adapter.preparePackageRoots(rootPath, files));
  }
  return contextByAdapter;
}

/**
 * Back-compat: convert a JS/TS import specifier to a bare package name.
 * Delegates to the JavaScript adapter. For multi-language use cases, prefer
 * `getAdapterFor(filePath).toPackageName(specifier)`.
 */
export function toPackageName(specifier: string): string | null {
  const jsAdapter = listAdapters().find((a) => a.id === 'javascript');
  return jsAdapter ? jsAdapter.toPackageName(specifier) : null;
}

/**
 * 0.16.0: targeted incremental update for watch mode. Given a graph and a
 * list of repo-relative paths that may have changed (added, modified, or
 * deleted), update the graph in place: re-stat each path, re-parse changed
 * ones, drop deleted ones, and fix up the cross-file derived indexes
 * (`localImporters`, `packageImporters`, `symbolDefs`, per-function
 * `fanIn`).
 *
 * Returns the same `graph` reference. Cheap: O(changedPaths) for the parse
 * pass; the fan-in recomputation is O(graph.files) but it's a single
 * walk over already-parsed entries (no IO).
 *
 * `changedPaths` should be repo-relative (forward-slash). Files that don't
 * exist are treated as deletions; files that do exist are re-parsed.
 */
export async function incrementallyUpdateGraph(
  graph: CodeGraph,
  rootPath: string,
  changedPaths: string[],
): Promise<CodeGraph> {
  if (changedPaths.length === 0) return graph;

  // 1.10+ — re-parse changed files first, then derive adapter contexts
  // against the post-update graph view. Previously contexts were computed
  // from the pre-update graph, so a newly-added manifest (pyproject.toml,
  // Cargo.toml, go.mod) batched with source files wasn't in the file list
  // passed to preparePackageRoots — the adapter derived a stale set of
  // package roots and mis-resolved that batch's imports until the next
  // tick. Parsing itself doesn't depend on context, so the reorder is safe.
  await Promise.all(changedPaths.map((rel) => processChangedPath(graph, rootPath, rel)));
  await refreshLocalStarReexporters(graph, rootPath);
  const contextByAdapter = await prepareAdapterContexts(
    rootPath,
    fakeFilesFromGraph(graph, rootPath),
  );
  expandLocalStarReexports(graph.files, contextByAdapter);
  rebuildIndexesIntoGraph(graph, contextByAdapter);
  computeFanIn(graph.files);
  computeFanOut(graph.files);
  graph.scannedFiles = graph.files.size;
  return graph;
}

async function refreshLocalStarReexporters(graph: CodeGraph, rootPath: string): Promise<void> {
  const reexporters = [...graph.files.values()]
    .filter((entry) => entry.imports.some(isLocalStarReexport))
    .map((entry) => entry.relativePath);
  await Promise.all(reexporters.map((rel) => processChangedPath(graph, rootPath, rel)));
}

/**
 * Build a FileEntry[]-shaped stand-in from the current graph, used as
 * the input to `preparePackageRoots` during incremental update — the
 * adapters need a complete view of repo layout to detect manifest
 * edits (pyproject.toml, go.mod) that would shift package roots.
 */
function fakeFilesFromGraph(graph: CodeGraph, rootPath: string): FileEntry[] {
  return [...graph.files.values()].map((gf) => ({
    relativePath: gf.relativePath,
    absolutePath: path.resolve(rootPath, gf.relativePath),
    directory: path.dirname(gf.relativePath),
    extension: path.extname(gf.relativePath),
    sizeBytes: 0,
  }));
}

/**
 * Rebuild the graph's cross-file indexes in place — clear, then refill
 * from scratch. The graph is small relative to parse cost so rebuilding
 * edges in O(N) keeps the logic simple and avoids orphan-edge bugs from
 * in-place patching.
 */
function rebuildIndexesIntoGraph(
  graph: CodeGraph,
  contextByAdapter: Map<LanguageAdapter, LanguageResolveContext>,
): void {
  const { localImporters, packageImporters, symbolDefs } = rebuildCrossFileIndexes(
    graph.files,
    contextByAdapter,
  );
  graph.localImporters.clear();
  for (const [k, v] of localImporters) graph.localImporters.set(k, v);
  graph.packageImporters.clear();
  for (const [k, v] of packageImporters) graph.packageImporters.set(k, v);
  graph.symbolDefs.clear();
  for (const [k, v] of symbolDefs) graph.symbolDefs.set(k, v);
}

// ── Query API ──────────────────────────────────────────────

export function packagesUsed(graph: CodeGraph): Set<string> {
  return new Set(graph.packageImporters.keys());
}

export function filesImportingPackage(graph: CodeGraph, pkg: string): string[] {
  const set = graph.packageImporters.get(pkg);
  return set ? [...set].sort() : [];
}

export function filesImportingFile(graph: CodeGraph, relativePath: string): string[] {
  const set = graph.localImporters.get(relativePath);
  return set ? [...set].sort() : [];
}

export function filesDefiningSymbol(graph: CodeGraph, name: string): string[] {
  const set = graph.symbolDefs.get(name);
  return set ? [...set].sort() : [];
}

export function importersOf(graph: CodeGraph, relativePath: string): string[] {
  return filesImportingFile(graph, relativePath);
}

export function exportsOf(graph: CodeGraph, relativePath: string): AstExport[] {
  return graph.files.get(relativePath)?.exports ?? [];
}

export function importsOf(graph: CodeGraph, relativePath: string): AstImport[] {
  return graph.files.get(relativePath)?.imports ?? [];
}
