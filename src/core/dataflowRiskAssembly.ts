import { shouldIncludeDataflowRisk, type DataflowRiskFilterContext } from './dataflowFilters.js';
import {
  compareDataflowRisks,
  findReachable,
  uniqueFiles,
  type DataflowFunctionIndex,
  type DataflowFunctionNode,
} from './dataflowTraversal.js';
import type { TaintFlow, TaintReport } from './taintTypes.js';
import type { DataflowRisk } from '../types.js';

export interface DataflowRiskAssemblyOptions {
  index: DataflowFunctionIndex;
  taint: TaintReport;
  filterContext: DataflowRiskFilterContext;
  maxDepth: number;
}

interface BridgeRiskCandidate {
  risk: DataflowRisk;
  sinkFile: string;
}

interface BridgeReachablePaths {
  sourcePath: DataflowFunctionNode[];
  sinkPath: DataflowFunctionNode[];
}

interface BridgeEndpoints {
  sourceNode: DataflowFunctionNode;
  sinkNode: DataflowFunctionNode;
  source: string;
  sink: string;
}

export function assembleDataflowRisks({
  index,
  taint,
  filterContext,
  maxDepth,
}: DataflowRiskAssemblyOptions): DataflowRisk[] {
  const seen = new Set<string>();
  const risks = [
    ...taintRisksFromFlows(taint, filterContext, seen),
    ...bridgeRisksFromIndex(index, filterContext, seen, maxDepth),
  ];
  risks.sort(compareDataflowRisks);
  return risks;
}

function taintRisksFromFlows(
  taint: TaintReport,
  filterContext: DataflowRiskFilterContext,
  seen: Set<string>,
): DataflowRisk[] {
  if (!taint.available) return [];
  const risks: DataflowRisk[] = [];
  for (const flow of taint.flows) {
    addFilteredRisk(risks, seen, riskFromTaintFlow(flow), filterContext);
  }
  return risks;
}

function riskFromTaintFlow(flow: TaintFlow): DataflowRisk {
  const kind = flow.path.length === 1 ? 'direct' : 'propagated';
  const key = `${kind}:${flow.sourceFn}:${flow.sinkFn}:${flow.source}:${flow.sink}:${flow.path.join('>')}`;
  return {
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
}

function bridgeRisksFromIndex(
  index: DataflowFunctionIndex,
  filterContext: DataflowRiskFilterContext,
  seen: Set<string>,
  maxDepth: number,
): DataflowRisk[] {
  const risks: DataflowRisk[] = [];
  for (const bridge of index.fns) {
    const candidate = bridgeRiskCandidate(bridge, index, maxDepth);
    if (!candidate) continue;
    addFilteredRisk(risks, seen, candidate.risk, filterContext, candidate.sinkFile);
  }
  return risks;
}

function bridgeRiskCandidate(
  bridge: DataflowFunctionNode,
  index: DataflowFunctionIndex,
  maxDepth: number,
): BridgeRiskCandidate | null {
  const paths = bridgeReachablePaths(bridge, index, maxDepth);
  if (!paths) return null;
  const endpoints = bridgeEndpoints(paths.sourcePath, paths.sinkPath);
  if (!endpoints) return null;
  return {
    risk: bridgeRiskFromPaths(bridge, paths, endpoints),
    sinkFile: endpoints.sinkNode.file,
  };
}

function bridgeReachablePaths(
  bridge: DataflowFunctionNode,
  index: DataflowFunctionIndex,
  maxDepth: number,
): BridgeReachablePaths | null {
  if (bridge.hasSource || bridge.hasSink) return null;
  const sourcePath = findReachable(bridge, index, (node) => node.hasSource, maxDepth);
  if (!sourcePath) return null;
  const sinkPath = findReachable(bridge, index, (node) => node.hasSink, maxDepth);
  if (!sinkPath) return null;
  return { sourcePath, sinkPath };
}

function bridgeEndpoints(
  sourcePath: DataflowFunctionNode[],
  sinkPath: DataflowFunctionNode[],
): BridgeEndpoints | null {
  const sourceNode = sourcePath[sourcePath.length - 1];
  const sinkNode = sinkPath[sinkPath.length - 1];
  if (sourceNode.id === sinkNode.id) return null;
  const source = sourceNode.source;
  const sink = sinkNode.sink;
  if (!source || !sink) return null;
  return { sourceNode, sinkNode, source, sink };
}

function bridgeRiskFromPaths(
  bridge: DataflowFunctionNode,
  paths: BridgeReachablePaths,
  endpoints: BridgeEndpoints,
): DataflowRisk {
  const { sourcePath, sinkPath } = paths;
  const { sourceNode, sinkNode, source, sink } = endpoints;
  const key = `bridge:${bridge.id}:${sourceNode.id}:${sinkNode.id}:${source}:${sink}`;
  return {
    key,
    kind: 'bridge',
    severity: 'error',
    confidence: sourcePath.length === 2 && sinkPath.length === 2 ? 'high' : 'medium',
    sourceFn: sourceNode.qualName,
    sinkFn: sinkNode.qualName,
    bridgeFn: bridge.qualName,
    source,
    sink,
    path: bridgeRiskPath(bridge, sourcePath, sinkPath),
    sourcePath: sourcePath.map((node) => node.qualName),
    sinkPath: sinkPath.map((node) => node.qualName),
    pathLength: Math.max(sourcePath.length, sinkPath.length),
    files: uniqueFiles([...sourcePath, ...sinkPath].map((node) => node.file)),
  };
}

function bridgeRiskPath(
  bridge: DataflowFunctionNode,
  sourcePath: DataflowFunctionNode[],
  sinkPath: DataflowFunctionNode[],
): string[] {
  return [
    bridge.qualName,
    ...sourcePath.slice(1).map((node) => node.qualName),
    ...sinkPath.slice(1).map((node) => node.qualName),
  ];
}

function addFilteredRisk(
  risks: DataflowRisk[],
  seen: Set<string>,
  risk: DataflowRisk,
  filterContext: DataflowRiskFilterContext,
  sinkFile?: string,
): void {
  if (seen.has(risk.key)) return;
  seen.add(risk.key);
  if (shouldIncludeDataflowRisk(risk, filterContext, sinkFile)) risks.push(risk);
}
