import type { CodeGraph, GraphFile } from './codeGraph.js';
import type { SemanticGraphEdge, SemanticGraphNode, SemanticGraphReport } from '../types.js';

export interface SemanticGraphOptions {
  maxNodes?: number;
  maxEdges?: number;
}

const DEFAULT_MAX_NODES = 10_000;
const DEFAULT_MAX_EDGES = 25_000;

export function buildSemanticGraph(
  graph: CodeGraph,
  options: SemanticGraphOptions = {},
): SemanticGraphReport {
  const limits = {
    maxNodes: Math.max(1, options.maxNodes ?? DEFAULT_MAX_NODES),
    maxEdges: Math.max(1, options.maxEdges ?? DEFAULT_MAX_EDGES),
  };
  const nodes: SemanticGraphNode[] = [];
  const edges: SemanticGraphEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  let truncated = false;

  function addNode(node: SemanticGraphNode): boolean {
    if (nodeIds.has(node.id)) return true;
    if (nodes.length >= limits.maxNodes) {
      truncated = true;
      return false;
    }
    nodes.push(node);
    nodeIds.add(node.id);
    return true;
  }

  function addEdge(edge: SemanticGraphEdge): void {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      truncated = true;
      return;
    }
    const key = `${edge.kind}\0${edge.from}\0${edge.to}\0${edge.label ?? ''}`;
    if (edgeIds.has(key)) return;
    if (edges.length >= limits.maxEdges) {
      truncated = true;
      return;
    }
    edges.push(edge);
    edgeIds.add(key);
  }

  const functionIdsByBareName = new Map<string, string[]>();
  const entries = [...graph.files.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [relativePath, file] of entries) {
    addFileNode(addNode, relativePath, file);
    for (const fn of file.functions ?? []) {
      const id = functionNodeId(relativePath, fn.name, fn.line);
      if (
        addNode({
          id,
          kind: 'function',
          label: fn.name,
          file: relativePath,
          line: fn.line,
          endLine: fn.endLine,
          metrics: {
            cyclomaticComplexity: fn.cyclomaticComplexity,
            fanIn: fn.fanIn,
            fanOut: fn.fanOut,
          },
        })
      ) {
        addEdge({
          from: fileNodeId(relativePath),
          to: id,
          kind: 'defines',
          label: fn.name,
        });
        const bare = bareName(fn.name);
        const list = functionIdsByBareName.get(bare) ?? [];
        list.push(id);
        functionIdsByBareName.set(bare, list);
      }
    }
  }

  for (const [pkg, importers] of [...graph.packageImporters.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const packageId = packageNodeId(pkg);
    addNode({ id: packageId, kind: 'package', label: pkg });
    for (const importer of [...importers].sort()) {
      addEdge({
        from: fileNodeId(importer),
        to: packageId,
        kind: 'imports_package',
        label: pkg,
      });
    }
  }

  for (const [target, importers] of [...graph.localImporters.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    for (const importer of [...importers].sort()) {
      addEdge({
        from: fileNodeId(importer),
        to: fileNodeId(target),
        kind: 'imports',
        label: target,
      });
    }
  }

  for (const [symbol, definingFiles] of [...graph.symbolDefs.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const symbolId = symbolNodeId(symbol);
    addNode({ id: symbolId, kind: 'symbol', label: symbol });
    for (const file of [...definingFiles].sort()) {
      addEdge({
        from: fileNodeId(file),
        to: symbolId,
        kind: 'exports',
        label: symbol,
      });
    }
  }

  for (const [relativePath, file] of entries) {
    for (const fn of file.functions ?? []) {
      const from = functionNodeId(relativePath, fn.name, fn.line);
      for (const callee of [...new Set(fn.callSites ?? [])].sort()) {
        const targets = functionIdsByBareName.get(callee);
        if (!targets) continue;
        for (const to of targets) {
          if (to === from) continue;
          addEdge({ from, to, kind: 'calls', label: callee });
        }
      }
    }
  }

  const totalFunctions = [...graph.files.values()].reduce(
    (count, file) => count + (file.functions?.length ?? 0),
    0,
  );
  const totalSymbols = graph.symbolDefs.size;
  const totalPackages = graph.packageImporters.size;

  return {
    schemaVersion: 3,
    nodes,
    edges,
    metrics: {
      totalFiles: graph.files.size,
      totalFunctions,
      totalPackages,
      totalSymbols,
      totalEdges: edges.length,
    },
    truncated,
    limits,
  };
}

function addFileNode(
  addNode: (node: SemanticGraphNode) => boolean,
  relativePath: string,
  file: GraphFile,
): void {
  addNode({
    id: fileNodeId(relativePath),
    kind: 'file',
    label: relativePath,
    file: relativePath,
    adapterId: file.adapterId,
    metrics: {
      lineCount: file.lineCount,
      cyclomaticComplexity: file.cyclomaticComplexity,
    },
  });
}

function fileNodeId(relativePath: string): string {
  return `file:${relativePath}`;
}

function functionNodeId(relativePath: string, name: string, line: number): string {
  return `function:${relativePath}#${name}@${line}`;
}

function packageNodeId(name: string): string {
  return `package:${name}`;
}

function symbolNodeId(name: string): string {
  return `symbol:${name}`;
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
