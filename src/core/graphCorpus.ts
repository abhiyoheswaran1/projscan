import path from 'node:path';
import { scanRepository } from './repositoryScanner.js';
import { buildCodeGraph } from './codeGraph.js';
import { buildSemanticGraph } from './semanticGraph.js';
import { computeDataflow } from './dataflow.js';
import type { GraphCorpusFixtureMetrics, GraphCorpusReport } from '../types/graphCorpus.js';

export interface GraphCorpusOptions {
  fixtures: string[];
}

export async function computeGraphCorpus(
  rootPath: string,
  options: GraphCorpusOptions,
): Promise<GraphCorpusReport> {
  const fixtures = await Promise.all(
    options.fixtures
      .slice()
      .sort((a, b) => fixtureName(a).localeCompare(fixtureName(b)))
      .map((fixture) => computeFixtureMetrics(rootPath, fixture)),
  );
  return {
    schemaVersion: 1,
    fixtures,
    totals: fixtures.reduce(
      (totals, fixture) => ({
        files: totals.files + fixture.files,
        functions: totals.functions + fixture.functions,
        packages: totals.packages + fixture.packages,
        symbols: totals.symbols + fixture.symbols,
        importEdges: totals.importEdges + fixture.importEdges,
        callEdges: totals.callEdges + fixture.callEdges,
        dataflowRisks: totals.dataflowRisks + fixture.dataflowRisks,
      }),
      {
        files: 0,
        functions: 0,
        packages: 0,
        symbols: 0,
        importEdges: 0,
        callEdges: 0,
        dataflowRisks: 0,
      },
    ),
  };
}

async function computeFixtureMetrics(
  rootPath: string,
  fixture: string,
): Promise<GraphCorpusFixtureMetrics> {
  const absolute = path.resolve(rootPath, fixture);
  const scan = await scanRepository(absolute);
  const graph = await buildCodeGraph(absolute, scan.files);
  const semantic = buildSemanticGraph(graph);
  const dataflow = computeDataflow(graph, { sources: [], sinks: [] });
  return {
    name: fixtureName(fixture),
    fixture,
    files: semantic.metrics.totalFiles,
    functions: semantic.metrics.totalFunctions,
    packages: semantic.metrics.totalPackages,
    symbols: semantic.metrics.totalSymbols,
    importEdges: semantic.edges.filter(
      (edge) => edge.kind === 'imports' || edge.kind === 'imports_package',
    ).length,
    callEdges: semantic.edges.filter((edge) => edge.kind === 'calls').length,
    dataflowRisks: dataflow.riskCount,
  };
}

function fixtureName(fixture: string): string {
  return path.basename(fixture.replace(/\\/g, '/'));
}
