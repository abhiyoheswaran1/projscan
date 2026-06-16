import type { FileInspection } from '../types.js';
import type { CodeGraph } from './codeGraph.js';

export type FileGraphMetrics = Pick<
  FileInspection,
  'cyclomaticComplexity' | 'fanIn' | 'fanOut' | 'functions'
>;

export function deriveFileGraphMetrics(graph: CodeGraph, relativePath: string): FileGraphMetrics {
  const graphFileEntry = graph.files.get(relativePath);
  if (!graphFileEntry) {
    return {
      cyclomaticComplexity: null,
      fanIn: null,
      fanOut: null,
      functions: undefined,
    };
  }

  let fanOut = 0;
  for (const importers of graph.localImporters.values()) {
    if (importers.has(relativePath)) fanOut++;
  }

  const functions =
    graphFileEntry.functions && graphFileEntry.functions.length > 0
      ? [...graphFileEntry.functions]
          .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
          .map((f) => ({
            name: f.name,
            line: f.line,
            endLine: f.endLine,
            cyclomaticComplexity: f.cyclomaticComplexity,
            fanIn: f.fanIn,
          }))
      : undefined;

  return {
    cyclomaticComplexity: graphFileEntry.parseOk ? graphFileEntry.cyclomaticComplexity : null,
    fanIn: graph.localImporters.get(relativePath)?.size ?? 0,
    fanOut,
    functions,
  };
}
