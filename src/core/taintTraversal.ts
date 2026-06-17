import type { TaintFunctionIndex, TaintFunctionNode } from './taintIndex.js';
import type { TaintFlow } from './taintTypes.js';

const MAX_DEPTH = 12;
const MAX_FRONTIER_PER_STEP = 5000;

export interface TaintTraversalResult {
  flows: TaintFlow[];
  truncatedSources: string[];
  maxDepth: number;
}

type FrontierEntry = { node: TaintFunctionNode; path: TaintFunctionNode[] };

export function findTaintFlows(index: TaintFunctionIndex): TaintTraversalResult {
  const flows: TaintFlow[] = [];
  const seen = new Set<string>();
  const truncatedSources: string[] = [];

  for (const sourceFn of index.fnByQual.values()) {
    if (!sourceFn.hasSource) continue;
    recordSameFunctionFlow(sourceFn, flows, seen);
    if (findFlowsFromSource(sourceFn, index, flows, seen)) {
      truncatedSources.push(sourceFn.qualName);
    }
  }

  sortTaintFlows(flows);
  return {
    flows,
    truncatedSources: [...new Set(truncatedSources)].sort(),
    maxDepth: MAX_DEPTH,
  };
}

function recordSameFunctionFlow(
  sourceFn: TaintFunctionNode,
  flows: TaintFlow[],
  seen: Set<string>,
): void {
  if (!sourceFn.hasSink) return;
  const key = `${sourceFn.id}::${sourceFn.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  flows.push({
    sourceFn: sourceFn.qualName,
    sinkFn: sourceFn.qualName,
    source: sourceFn.sourceHit!,
    sink: sourceFn.sinkHit!,
    path: [sourceFn.qualName],
    files: [sourceFn.file],
  });
}

function findFlowsFromSource(
  sourceFn: TaintFunctionNode,
  index: TaintFunctionIndex,
  flows: TaintFlow[],
  seen: Set<string>,
): boolean {
  const visited = new Set<string>([sourceFn.id]);
  let frontier: FrontierEntry[] = [{ node: sourceFn, path: [sourceFn] }];
  let depth = 0;
  let frontierCapped = false;

  while (frontier.length > 0 && depth < MAX_DEPTH) {
    depth += 1;
    const result = expandFrontier(sourceFn, frontier, index, visited, flows, seen);
    frontier = result.next;
    frontierCapped ||= result.frontierCapped;
    if (result.frontierCapped) break;
  }

  return frontier.length > 0 || frontierCapped;
}

function expandFrontier(
  sourceFn: TaintFunctionNode,
  frontier: FrontierEntry[],
  index: TaintFunctionIndex,
  visited: Set<string>,
  flows: TaintFlow[],
  seen: Set<string>,
): { next: FrontierEntry[]; frontierCapped: boolean } {
  const next: FrontierEntry[] = [];

  for (const entry of frontier) {
    if (expandFrontierEntry(sourceFn, entry, index, visited, flows, seen, next)) {
      return { next, frontierCapped: true };
    }
  }

  return { next, frontierCapped: false };
}

function expandFrontierEntry(
  sourceFn: TaintFunctionNode,
  entry: FrontierEntry,
  index: TaintFunctionIndex,
  visited: Set<string>,
  flows: TaintFlow[],
  seen: Set<string>,
  next: FrontierEntry[],
): boolean {
  for (const calleeName of entry.node.callees) {
    const candidates = index.fnsByBareName.get(calleeName) ?? [];
    for (const candidate of candidates) {
      if (addCandidate(sourceFn, entry, candidate, visited, flows, seen, next)) return true;
    }
  }
  return false;
}

function addCandidate(
  sourceFn: TaintFunctionNode,
  entry: FrontierEntry,
  candidate: TaintFunctionNode,
  visited: Set<string>,
  flows: TaintFlow[],
  seen: Set<string>,
  next: FrontierEntry[],
): boolean {
  if (visited.has(candidate.id)) return false;
  visited.add(candidate.id);
  const newPath = [...entry.path, candidate];
  if (candidate.hasSink) {
    recordPathFlow(sourceFn, candidate, newPath, flows, seen);
    return false;
  }
  next.push({ node: candidate, path: newPath });
  return next.length >= MAX_FRONTIER_PER_STEP;
}

function recordPathFlow(
  sourceFn: TaintFunctionNode,
  sinkFn: TaintFunctionNode,
  path: TaintFunctionNode[],
  flows: TaintFlow[],
  seen: Set<string>,
): void {
  const flowKey = `${sourceFn.id}::${sinkFn.id}`;
  if (seen.has(flowKey)) return;
  seen.add(flowKey);
  flows.push({
    sourceFn: sourceFn.qualName,
    sinkFn: sinkFn.qualName,
    source: sourceFn.sourceHit!,
    sink: sinkFn.sinkHit!,
    path: path.map((node) => node.qualName),
    files: filesInPath(path),
  });
}

function filesInPath(path: TaintFunctionNode[]): string[] {
  const files: string[] = [];
  for (const node of path) {
    if (files[files.length - 1] !== node.file) files.push(node.file);
  }
  return files;
}

function sortTaintFlows(flows: TaintFlow[]): void {
  flows.sort((a, b) => {
    if (a.sourceFn !== b.sourceFn) return a.sourceFn.localeCompare(b.sourceFn);
    return a.sinkFn.localeCompare(b.sinkFn);
  });
}
