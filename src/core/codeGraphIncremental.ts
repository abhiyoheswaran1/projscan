import path from 'node:path';
import type { FileEntry } from '../types.js';
import { computeFanIn, computeFanOut } from './codeGraphFanMetrics.js';
import { rebuildCrossFileIndexes } from './codeGraphIndexes.js';
import { processChangedPath } from './codeGraphParsing.js';
import { expandLocalStarReexports, isLocalStarReexport } from './codeGraphReexports.js';
import type { CodeGraph } from './codeGraphTypes.js';
import type { LanguageAdapter, LanguageResolveContext } from './languages/LanguageAdapter.js';
import { prepareAdapterContexts } from './codeGraphAdapterContexts.js';

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

  // Re-parse changed files first, then derive adapter contexts against the
  // post-update graph so manifest changes are visible before import expansion.
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

function fakeFilesFromGraph(graph: CodeGraph, rootPath: string): FileEntry[] {
  return [...graph.files.values()].map((gf) => ({
    relativePath: gf.relativePath,
    absolutePath: path.resolve(rootPath, gf.relativePath),
    directory: path.dirname(gf.relativePath),
    extension: path.extname(gf.relativePath),
    sizeBytes: 0,
  }));
}

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
