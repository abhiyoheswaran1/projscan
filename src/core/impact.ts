import type { CodeGraph } from './codeGraph.js';
import type { ImpactNode, ImpactReport } from '../types.js';

const DEFAULT_MAX_DISTANCE = 10;

export interface ImpactOptions {
  /** Stop BFS after this many hops. Default 10. Capped at 1 (lower bound). */
  maxDistance?: number;
  /**
   * 1.6+ — when present, after computing in-repo reachability, also walk
   * the listed sibling-repo graphs and add files whose callSites or
   * imports reference the target. Each cross-repo node is annotated
   * with the repo name. Map keys are repo names (the human-readable
   * name from the workspace); values are the per-repo CodeGraph.
   */
  crossRepoGraphs?: Map<string, CodeGraph>;
}

/**
 * Compute the transitive blast radius of a file or symbol against the local
 * code graph. Two modes:
 *
 *   File mode: target is a repo-relative file path. The reachable set is
 *   every file that transitively imports it - i.e. BFS over
 *   `graph.localImporters`. Distance 1 = direct importer, 2 = importer of an
 *   importer, etc. The target itself is not in the result.
 *
 *   Symbol mode: target is a symbol name. We seed BFS from
 *   (a) every file whose `callSites` includes the name (the direct callers,
 *   distance 1) and (b) walk those callers' transitive importers from there.
 *   Distance 1 = direct caller; distance 2+ = files that import a caller.
 *
 * Cycle-safe via a visited-set; deterministic ordering (distance asc, file
 * asc) so two runs produce identical reports.
 */
export function computeImpact(
  graph: CodeGraph,
  target: { kind: 'file' | 'symbol'; value: string },
  options: ImpactOptions = {},
): ImpactReport {
  const maxDistance = Math.max(1, options.maxDistance ?? DEFAULT_MAX_DISTANCE);

  const base = target.kind === 'file'
    ? impactForFile(graph, target.value, maxDistance)
    : impactForSymbol(graph, target.value, maxDistance);

  // 1.6+ — fold in cross-repo reachability. Symbol mode is the
  // meaningful case (cross-repo file imports require real path
  // resolution which the lightweight scan doesn't do). For symbol
  // mode: any sibling-repo file whose callSites includes the symbol
  // name is a cross-repo direct caller (distance 1).
  if (options.crossRepoGraphs && options.crossRepoGraphs.size > 0) {
    return foldInCrossRepo(base, target, options.crossRepoGraphs);
  }
  return base;
}

function foldInCrossRepo(
  base: ImpactReport,
  target: { kind: 'file' | 'symbol'; value: string },
  crossRepoGraphs: Map<string, CodeGraph>,
): ImpactReport {
  if (!base.available) return base;
  if (target.kind !== 'symbol') {
    // File-mode cross-repo would need path-resolution against each
    // sibling repo's import graph, which is more involved than this
    // first cut. Document and skip.
    return { ...base, totalReachableByRepo: { '(this repo)': base.totalReachable } };
  }
  const extra: ImpactNode[] = [];
  const totalsByRepo: Record<string, number> = { '(this repo)': base.totalReachable };
  for (const [repoName, repoGraph] of crossRepoGraphs) {
    let count = 0;
    for (const [filePath, gf] of repoGraph.files) {
      if (gf.callSites && gf.callSites.includes(target.value)) {
        extra.push({ file: filePath, distance: 1, repo: repoName });
        count += 1;
      }
    }
    if (count > 0) totalsByRepo[repoName] = count;
  }
  const reachable = [...base.reachable, ...extra].sort(compareNodes);
  return {
    ...base,
    reachable,
    totalReachable: reachable.length,
    totalReachableByRepo: totalsByRepo,
  };
}

function impactForFile(graph: CodeGraph, file: string, maxDistance: number): ImpactReport {
  if (!graph.files.has(file)) {
    return {
      available: false,
      reason: `File "${file}" is not in the code graph (not parsed by any adapter, or doesn't exist).`,
      target: { kind: 'file', value: file },
      definitionFiles: [],
      directCallers: [],
      reachable: [],
      totalReachable: 0,
      truncated: false,
      maxDistance,
    };
  }

  const { reachable, truncated } = bfsImporters(graph, [file], maxDistance, new Set([file]));
  return {
    available: true,
    target: { kind: 'file', value: file },
    definitionFiles: [],
    directCallers: [],
    reachable: reachable.sort(compareNodes),
    totalReachable: reachable.length,
    truncated,
    maxDistance,
  };
}

function impactForSymbol(graph: CodeGraph, name: string, maxDistance: number): ImpactReport {
  // Definitions are informational - the answer to "where is this defined?"
  const defSet = graph.symbolDefs.get(name) ?? new Set<string>();
  const definitionFiles = [...defSet].sort();

  // Direct callers: any file whose callSites contain the name. The graph
  // doesn't index callSites for fast lookup, so we scan once. O(N + total
  // callSite entries) per query; fine since callSites is deduped per file.
  const directCallers: string[] = [];
  const callerSet = new Set<string>();
  for (const [path, gf] of graph.files) {
    if (gf.callSites && gf.callSites.includes(name)) {
      directCallers.push(path);
      callerSet.add(path);
    }
  }
  directCallers.sort();

  if (directCallers.length === 0 && definitionFiles.length === 0) {
    return {
      available: false,
      reason: `Symbol "${name}" is not defined or called anywhere in the graph.`,
      target: { kind: 'symbol', value: name },
      definitionFiles,
      directCallers,
      reachable: [],
      totalReachable: 0,
      truncated: false,
      maxDistance,
    };
  }

  // Direct callers count as distance 1. Their transitive importers extend
  // outward. Visited starts with the symbol's definition files (so they
  // don't appear as reachable from themselves) plus the direct callers
  // (which we'll include as distance 1 explicitly below).
  const visited = new Set<string>(definitionFiles);
  const reachable: ImpactNode[] = [];
  for (const c of directCallers) {
    if (!visited.has(c)) {
      reachable.push({ file: c, distance: 1 });
      visited.add(c);
    }
  }

  // Now BFS from each direct caller through localImporters, starting at
  // distance 2.
  const { reachable: extra, truncated } = bfsImporters(graph, directCallers, maxDistance, visited, 2);
  reachable.push(...extra);

  return {
    available: true,
    target: { kind: 'symbol', value: name },
    definitionFiles,
    directCallers,
    reachable: reachable.sort(compareNodes),
    totalReachable: reachable.length,
    truncated,
    maxDistance,
  };
}

/**
 * BFS over `localImporters` starting from each seed. `visited` is updated
 * in place; seeds should already be in it. Returns nodes whose distance
 * <= maxDistance, plus a `truncated` flag set when we stopped at the
 * frontier because more nodes existed beyond.
 */
function bfsImporters(
  graph: CodeGraph,
  seeds: string[],
  maxDistance: number,
  visited: Set<string>,
  startDistance = 1,
): { reachable: ImpactNode[]; truncated: boolean } {
  const reachable: ImpactNode[] = [];
  let frontier = seeds.slice();
  let distance = startDistance;
  let truncated = false;

  while (frontier.length > 0) {
    if (distance > maxDistance) {
      // The next ring exists but we won't enumerate it.
      // Detect by checking if frontier expands at all from any seed.
      truncated = wouldExpand(graph, frontier, visited);
      break;
    }
    const next: string[] = [];
    for (const file of frontier) {
      const importers = graph.localImporters.get(file);
      if (!importers) continue;
      for (const importer of importers) {
        if (visited.has(importer)) continue;
        visited.add(importer);
        // The seed itself shouldn't appear at distance 0 in the result -
        // we add only at the *new* distance produced from this layer.
        if (distance >= startDistance) {
          reachable.push({ file: importer, distance });
        }
        next.push(importer);
      }
    }
    frontier = next;
    distance++;
  }

  return { reachable, truncated };
}

/**
 * Would another BFS layer add new nodes? Used to set `truncated`. Cheap:
 * we don't enumerate, just probe one node.
 */
function wouldExpand(graph: CodeGraph, frontier: string[], visited: Set<string>): boolean {
  for (const file of frontier) {
    const importers = graph.localImporters.get(file);
    if (!importers) continue;
    for (const importer of importers) {
      if (!visited.has(importer)) return true;
    }
  }
  return false;
}

function compareNodes(a: ImpactNode, b: ImpactNode): number {
  if (a.distance !== b.distance) return a.distance - b.distance;
  return a.file.localeCompare(b.file);
}
