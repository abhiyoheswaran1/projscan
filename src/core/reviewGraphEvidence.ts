import type { CodeGraph } from './codeGraph.js';
import { buildSemanticGraph } from './semanticGraph.js';
import type { GraphEvidenceSummary } from '../types/graph.js';

export function buildReviewGraphEvidence(
  graph: CodeGraph,
  touchedFiles: Set<string>,
  dataflowRisks: number,
  scopeFiles?: Set<string>,
): GraphEvidenceSummary {
  const evidenceGraph = scopeFiles ? scopeGraphToFiles(graph, scopeFiles) : graph;
  const semantic = buildSemanticGraph(evidenceGraph, { maxNodes: 5_000, maxEdges: 10_000 });
  const changedFunctions = [...touchedFiles].reduce((count, file) => {
    return count + (evidenceGraph.files.get(file)?.functions?.length ?? 0);
  }, 0);
  return {
    schemaVersion: 1,
    changedFiles: touchedFiles.size,
    changedFunctions,
    totalFunctions: semantic.metrics.totalFunctions,
    totalPackages: semantic.metrics.totalPackages,
    totalCallEdges: semantic.edges.filter((edge) => edge.kind === 'calls').length,
    dataflowRisks,
    topPackages: topPackages(evidenceGraph),
  };
}

function scopeGraphToFiles(graph: CodeGraph, files: Set<string>): CodeGraph {
  const scopedFiles = new Map([...graph.files.entries()].filter(([file]) => files.has(file)));
  const packageImporters = filterImporterMap(graph.packageImporters, files);
  const localImporters = new Map<string, Set<string>>();
  for (const [target, importers] of graph.localImporters) {
    if (!files.has(target)) continue;
    const scopedImporters = new Set([...importers].filter((file) => files.has(file)));
    if (scopedImporters.size > 0) localImporters.set(target, scopedImporters);
  }
  const symbolDefs = filterImporterMap(graph.symbolDefs, files);
  return {
    files: scopedFiles,
    packageImporters,
    localImporters,
    symbolDefs,
    scannedFiles: scopedFiles.size,
  };
}

function filterImporterMap(
  source: Map<string, Set<string>>,
  files: Set<string>,
): Map<string, Set<string>> {
  const filtered = new Map<string, Set<string>>();
  for (const [name, importers] of source) {
    const scopedImporters = new Set([...importers].filter((file) => files.has(file)));
    if (scopedImporters.size > 0) filtered.set(name, scopedImporters);
  }
  return filtered;
}

function topPackages(graph: CodeGraph): string[] {
  return [...graph.packageImporters.entries()]
    .map(([name, importers]) => ({ name, count: importers.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((entry) => entry.name);
}
