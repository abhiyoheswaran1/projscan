import type { CodeGraph } from './codeGraph.js';
import {
  buildFunctionIndex,
  compareDataflowRisks,
  findReachable,
  uniqueFiles,
} from './dataflowTraversal.js';
import { shouldIncludeDataflowRisk, type DataflowRiskFilterContext } from './dataflowFilters.js';
import {
  DEFAULT_TAINT_SINKS,
  DEFAULT_TAINT_SOURCES,
  computeTaint,
  type TaintConfig,
} from './taint.js';
import type { DataflowReport, DataflowRisk } from '../types.js';

export interface DataflowOptions {
  maxDepth?: number;
  /** Include risks whose path touches test files. Default false for signal. */
  includeTests?: boolean;
  /** Include broad default readFile/writeFile-style risks. Custom sources/sinks still report. */
  includeBroadFileIo?: boolean;
  /** Include default risks whose paths touch generated/codegen files. Custom sources/sinks still report. */
  includeGenerated?: boolean;
}

const DEFAULT_MAX_DEPTH = 12;

export function computeDataflow(
  graph: CodeGraph,
  config: TaintConfig = { sources: [], sinks: [] },
  options: DataflowOptions = {},
): DataflowReport {
  const customSources = new Set(config.sources ?? []);
  const customSinks = new Set(config.sinks ?? []);
  const sources = new Set([...DEFAULT_TAINT_SOURCES, ...customSources]);
  const sinks = new Set([...DEFAULT_TAINT_SINKS, ...customSinks]);
  const index = buildFunctionIndex(graph, sources, sinks, customSources, customSinks);
  const filterContext: DataflowRiskFilterContext = {
    graph,
    customSources,
    customSinks,
    includeTests: options.includeTests === true,
    includeBroadFileIo: options.includeBroadFileIo === true,
    includeGenerated: options.includeGenerated === true,
  };
  if (index.fns.length === 0 || index.totalCallSites === 0) {
    return {
      available: false,
      reason: 'No functions with callSites in the graph. Dataflow requires per-function callSites.',
      riskCount: 0,
      risks: [],
      effectiveSources: [...sources],
      effectiveSinks: [...sinks],
    };
  }

  const risks: DataflowRisk[] = [];
  const seen = new Set<string>();
  const taint = computeTaint(graph, config);
  if (taint.available) {
    for (const flow of taint.flows) {
      const kind = flow.path.length === 1 ? 'direct' : 'propagated';
      const key = `${kind}:${flow.sourceFn}:${flow.sinkFn}:${flow.source}:${flow.sink}:${flow.path.join('>')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const risk: DataflowRisk = {
        key,
        kind,
        severity: 'error',
        confidence: flow.path.length <= 2 ? 'high' : 'medium',
        sourceFn: flow.sourceFn,
        sinkFn: flow.sinkFn,
        source: flow.source,
        sink: flow.sink,
        path: flow.path,
        pathLength: flow.path.length,
        files: flow.files,
      };
      if (shouldIncludeDataflowRisk(risk, filterContext)) risks.push(risk);
    }
  }

  const maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  for (const bridge of index.fns) {
    if (bridge.hasSource || bridge.hasSink) continue;
    const sourcePath = findReachable(bridge, index, (node) => node.hasSource, maxDepth);
    if (!sourcePath) continue;
    const sinkPath = findReachable(bridge, index, (node) => node.hasSink, maxDepth);
    if (!sinkPath) continue;
    const sourceNode = sourcePath[sourcePath.length - 1];
    const sinkNode = sinkPath[sinkPath.length - 1];
    if (sourceNode.id === sinkNode.id) continue;
    const source = sourceNode.source;
    const sink = sinkNode.sink;
    if (!source || !sink) continue;
    const key = `bridge:${bridge.id}:${sourceNode.id}:${sinkNode.id}:${source}:${sink}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const files = uniqueFiles([...sourcePath, ...sinkPath].map((node) => node.file));
    const path = [
      bridge.qualName,
      ...sourcePath.slice(1).map((node) => node.qualName),
      ...sinkPath.slice(1).map((node) => node.qualName),
    ];
    const risk: DataflowRisk = {
      key,
      kind: 'bridge',
      severity: 'error',
      confidence: sourcePath.length === 2 && sinkPath.length === 2 ? 'high' : 'medium',
      sourceFn: sourceNode.qualName,
      sinkFn: sinkNode.qualName,
      bridgeFn: bridge.qualName,
      source,
      sink,
      path,
      sourcePath: sourcePath.map((node) => node.qualName),
      sinkPath: sinkPath.map((node) => node.qualName),
      pathLength: Math.max(sourcePath.length, sinkPath.length),
      files,
    };
    if (shouldIncludeDataflowRisk(risk, filterContext, sinkNode.file)) risks.push(risk);
  }

  risks.sort(compareDataflowRisks);
  return {
    available: true,
    riskCount: risks.length,
    risks,
    effectiveSources: [...sources],
    effectiveSinks: [...sinks],
    truncated: taint.truncated,
    truncatedSources: taint.truncatedSources,
    maxDepth,
  };
}
