import type { CodeGraph } from './codeGraph.js';
import type { CouplingReport, FileCoupling, ImportCycle } from '../types.js';

/**
 * Per-file coupling metrics + circular-import detection from the local code
 * graph.
 *
 * Fan-in is read directly from `graph.localImporters` (built during graph
 * construction). Fan-out is the count of distinct local files this file
 * imports — derived by inverting `localImporters` once. Instability is Bob
 * Martin's I = Ce / (Ca + Ce); a file with zero in/out gets 0.
 *
 * Cycles are strongly-connected components of size >= 2 in the directed
 * import graph (file -> imported file). Computed via Tarjan's SCC, iterative
 * to survive deep monorepos.
 */
export function computeCoupling(graph: CodeGraph): CouplingReport {
  // Build outgoing local-edge adjacency by inverting localImporters.
  // (localImporters[X] = files that import X. Invert to get
  //  localImports[Y] = files that Y imports.)
  const outgoing = new Map<string, Set<string>>();
  for (const file of graph.files.keys()) outgoing.set(file, new Set());
  for (const [imported, importers] of graph.localImporters) {
    for (const importer of importers) {
      if (!outgoing.has(importer)) outgoing.set(importer, new Set());
      outgoing.get(importer)!.add(imported);
    }
  }

  const files: FileCoupling[] = [];
  for (const relativePath of graph.files.keys()) {
    const fanIn = graph.localImporters.get(relativePath)?.size ?? 0;
    const fanOut = outgoing.get(relativePath)?.size ?? 0;
    const denom = fanIn + fanOut;
    const instability = denom === 0 ? 0 : Math.round((fanOut / denom) * 1000) / 1000;
    files.push({ relativePath, fanIn, fanOut, instability });
  }

  // Stable order: by fanIn desc, then path asc — gives the most-depended-on
  // files first, matching how a reviewer scans for coupling risk.
  files.sort((a, b) => {
    if (b.fanIn !== a.fanIn) return b.fanIn - a.fanIn;
    return a.relativePath.localeCompare(b.relativePath);
  });

  const cycles = findCycles(outgoing);

  return {
    files,
    cycles,
    totalFiles: files.length,
    totalCycles: cycles.length,
  };
}

/**
 * Iterative Tarjan's SCC. Returns components of size >= 2 only; self-loops
 * (a file importing itself, vanishingly rare) are ignored to keep the noise
 * floor at zero.
 */
function findCycles(adj: Map<string, Set<string>>): ImportCycle[] {
  const nodes = [...adj.keys()];
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let nextIndex = 0;
  const sccs: string[][] = [];

  // Iterative driver per node. Each work item carries the iterator state
  // (which successor index we're processing) so we can resume after a child
  // returns.
  interface Frame {
    node: string;
    successors: string[];
    i: number;
  }

  const pushNode = (callStack: Frame[], node: string): void => {
    index.set(node, nextIndex);
    lowlink.set(node, nextIndex);
    nextIndex++;
    stack.push(node);
    onStack.add(node);
    callStack.push({
      node,
      successors: [...(adj.get(node) ?? new Set())],
      i: 0,
    });
  };

  for (const start of nodes) {
    if (index.has(start)) continue;

    const callStack: Frame[] = [];
    pushNode(callStack, start);

    while (callStack.length > 0) {
      const top = callStack[callStack.length - 1];
      if (top.i < top.successors.length) {
        const w = top.successors[top.i++];
        if (!index.has(w)) {
          pushNode(callStack, w);
        } else if (onStack.has(w)) {
          lowlink.set(top.node, Math.min(lowlink.get(top.node)!, index.get(w)!));
        }
      } else {
        // All successors processed — finalize this frame.
        if (lowlink.get(top.node) === index.get(top.node)) {
          const component: string[] = [];
          while (true) {
            const w = stack.pop()!;
            onStack.delete(w);
            component.push(w);
            if (w === top.node) break;
          }
          if (component.length >= 2) sccs.push(component);
        }
        callStack.pop();
        if (callStack.length > 0) {
          const parent = callStack[callStack.length - 1];
          lowlink.set(parent.node, Math.min(lowlink.get(parent.node)!, lowlink.get(top.node)!));
        }
      }
    }
  }

  // Sort each component for deterministic output, then sort cycles by size desc.
  const cycles: ImportCycle[] = sccs.map((component) => {
    const sorted = [...component].sort();
    return { files: sorted, size: sorted.length };
  });
  cycles.sort((a, b) => {
    if (b.size !== a.size) return b.size - a.size;
    return a.files[0].localeCompare(b.files[0]);
  });
  return cycles;
}

/** Filter helper used by the MCP/CLI surface. */
export function filterCoupling(
  report: CouplingReport,
  filter: 'all' | 'high_fan_in' | 'high_fan_out' | 'cycles_only',
): FileCoupling[] {
  if (filter === 'cycles_only') {
    const inCycle = new Set<string>();
    for (const c of report.cycles) for (const f of c.files) inCycle.add(f);
    return report.files.filter((f) => inCycle.has(f.relativePath));
  }
  if (filter === 'high_fan_in') {
    return [...report.files].sort((a, b) => b.fanIn - a.fanIn);
  }
  if (filter === 'high_fan_out') {
    return [...report.files].sort((a, b) => b.fanOut - a.fanOut);
  }
  return report.files;
}
