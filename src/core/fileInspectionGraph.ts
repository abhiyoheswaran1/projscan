import type { ExportInfo, FileEntry, ImportInfo } from '../types.js';
import { buildCodeGraph, type CodeGraph, type GraphFile } from './codeGraph.js';
import { mapExportType } from './fileExportTypes.js';
import { loadCachedGraph, saveCachedGraph } from './indexCache.js';

export async function resolveInspectionGraph(
  resolvedRoot: string,
  files: FileEntry[],
  graph: CodeGraph | undefined,
): Promise<CodeGraph> {
  if (graph) return graph;
  const cached = await loadCachedGraph(resolvedRoot);
  const built = await buildCodeGraph(resolvedRoot, files, cached);
  await saveCachedGraph(resolvedRoot, built);
  return built;
}

export function importsFromGraphFile(graphFile: GraphFile | undefined): ImportInfo[] {
  if (!graphFile) return [];
  return graphFile.imports.map((i) => ({
    source: i.source,
    specifiers: i.specifiers,
    isRelative: i.source.startsWith('.') || i.source.startsWith('/'),
  }));
}

export function exportsFromGraphFile(graphFile: GraphFile | undefined): ExportInfo[] {
  if (!graphFile) return [];
  return graphFile.exports.map((e) => ({
    name: e.name,
    type: mapExportType(e.kind),
  }));
}
