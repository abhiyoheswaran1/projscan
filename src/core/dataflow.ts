import type { CodeGraph } from './codeGraph.js';
import { type DataflowRiskFilterContext } from './dataflowFilters.js';
import { assembleDataflowRisks } from './dataflowRiskAssembly.js';
import { buildFunctionIndex } from './dataflowTraversal.js';
import {
  DEFAULT_TAINT_SINKS,
  DEFAULT_TAINT_SOURCES,
  computeTaint,
  type TaintConfig,
} from './taint.js';
import type { DataflowReport } from '../types.js';

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

  const taint = computeTaint(graph, config);
  const maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const risks = assembleDataflowRisks({ index, taint, filterContext, maxDepth });
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
