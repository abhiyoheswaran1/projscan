import type { FunctionInfo } from './ast.js';
import type { CodeGraph } from './codeGraph.js';
import {
  DEFAULT_TAINT_SINKS,
  DEFAULT_TAINT_SOURCES,
  computeTaint,
  type TaintConfig,
} from './taint.js';
import type { DataflowReport, DataflowRisk } from '../types.js';

export interface DataflowOptions {
  maxDepth?: number;
}

interface FnNode {
  id: string;
  qualName: string;
  bareName: string;
  file: string;
  line: number;
  callees: string[];
  references: string[];
  source: string | null;
  sink: string | null;
  hasSource: boolean;
  hasSink: boolean;
}

interface FnIndex {
  fns: FnNode[];
  byBareName: Map<string, FnNode[]>;
  totalCallSites: number;
}

const DEFAULT_MAX_DEPTH = 12;

export function computeDataflow(
  graph: CodeGraph,
  config: TaintConfig = { sources: [], sinks: [] },
  options: DataflowOptions = {},
): DataflowReport {
  const sources = new Set([...DEFAULT_TAINT_SOURCES, ...(config.sources ?? [])]);
  const sinks = new Set([...DEFAULT_TAINT_SINKS, ...(config.sinks ?? [])]);
  const index = buildFunctionIndex(graph, sources, sinks);
  if (index.fns.length === 0 || index.totalCallSites === 0) {
    return {
      available: false,
      reason:
        'No functions with callSites in the graph. Dataflow requires per-function callSites.',
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
      risks.push({
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
      });
    }
  }

  const maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  for (const bridge of index.fns) {
    if (bridge.hasSource || bridge.hasSink) continue;
    const sourcePath = findReachable(
      bridge,
      index,
      (node) => node.hasSource,
      maxDepth,
    );
    if (!sourcePath) continue;
    const sinkPath = findReachable(
      bridge,
      index,
      (node) => node.hasSink,
      maxDepth,
    );
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
    risks.push({
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
    });
  }

  risks.sort(compareRisks);
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

function buildFunctionIndex(
  graph: CodeGraph,
  sources: Set<string>,
  sinks: Set<string>,
): FnIndex {
  const fns: FnNode[] = [];
  const byBareName = new Map<string, FnNode[]>();
  let totalCallSites = 0;
  for (const [file, entry] of graph.files) {
    for (const fn of entry.functions ?? []) {
      const node = functionNode(file, fn, sources, sinks);
      totalCallSites += node.callees.length;
      fns.push(node);
      const list = byBareName.get(node.bareName) ?? [];
      list.push(node);
      byBareName.set(node.bareName, list);
    }
  }
  return { fns, byBareName, totalCallSites };
}

function functionNode(
  file: string,
  fn: FunctionInfo,
  sources: Set<string>,
  sinks: Set<string>,
): FnNode {
  const callees = fn.callSites ?? [];
  const references = fn.references ?? [];
  const source = pickHit([...callees, ...references], sources);
  const sink = pickHit(callees, sinks);
  return {
    id: `${file}::${fn.name}@${fn.line}`,
    qualName: fn.name,
    bareName: bareName(fn.name),
    file,
    line: fn.line,
    callees,
    references,
    source,
    sink,
    hasSource: source !== null,
    hasSink: sink !== null,
  };
}

function findReachable(
  start: FnNode,
  index: FnIndex,
  predicate: (node: FnNode) => boolean,
  maxDepth: number,
): FnNode[] | null {
  type FrontierEntry = { node: FnNode; path: FnNode[] };
  const visited = new Set<string>([start.id]);
  let frontier: FrontierEntry[] = [{ node: start, path: [start] }];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: FrontierEntry[] = [];
    for (const entry of frontier) {
      for (const callee of entry.node.callees) {
        const targets = index.byBareName.get(callee) ?? [];
        for (const target of targets) {
          if (visited.has(target.id)) continue;
          const path = [...entry.path, target];
          if (predicate(target)) return path;
          visited.add(target.id);
          next.push({ node: target, path });
        }
      }
    }
    if (next.length === 0) return null;
    frontier = next;
  }
  return null;
}

function pickHit(values: string[], set: Set<string>): string | null {
  for (const value of values) {
    if (set.has(value)) return value;
  }
  return null;
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}

function uniqueFiles(files: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file)) continue;
    seen.add(file);
    out.push(file);
  }
  return out;
}

function compareRisks(a: DataflowRisk, b: DataflowRisk): number {
  const severityOrder = { error: 0, warning: 1 };
  const kindOrder = { direct: 0, bridge: 1, propagated: 2 };
  const severityDelta = severityOrder[a.severity] - severityOrder[b.severity];
  if (severityDelta !== 0) return severityDelta;
  const kindDelta = kindOrder[a.kind] - kindOrder[b.kind];
  if (kindDelta !== 0) return kindDelta;
  if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;
  return a.key.localeCompare(b.key);
}
