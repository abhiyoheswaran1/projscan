import type { FunctionInfo } from './ast.js';
import type { CodeGraph, GraphFile } from './codeGraph.js';
import { isDefaultMisidentifiedDatabaseSink } from './dataflowDatabaseSinks.js';
import { frameworkRequestSourceForFunction } from './frameworkSources.js';
import type { DataflowRisk } from '../types.js';

export interface DataflowFunctionNode {
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

export interface DataflowFunctionIndex {
  fns: DataflowFunctionNode[];
  byBareName: Map<string, DataflowFunctionNode[]>;
  importedFilesByFile: Map<string, Set<string>>;
  totalCallSites: number;
}

const CALL_SHAPED_DEFAULT_SOURCES = new Set(['getInput', 'readFile', 'readFileSync', 'stdin']);
const DEFAULT_HTTP_PROPERTY_SOURCES = new Set(['body', 'query', 'params', 'headers', 'cookies']);

export function buildFunctionIndex(
  graph: CodeGraph,
  sources: Set<string>,
  sinks: Set<string>,
  customSources: Set<string>,
  customSinks: Set<string>,
): DataflowFunctionIndex {
  const fns: DataflowFunctionNode[] = [];
  const byBareName = new Map<string, DataflowFunctionNode[]>();
  const importedFilesByFile = buildImportedFilesByFile(graph);
  let totalCallSites = 0;
  for (const [file, entry] of graph.files) {
    for (const fn of entry.functions ?? []) {
      const node = functionNode(file, entry, fn, sources, sinks, customSources, customSinks);
      totalCallSites += node.callees.length;
      fns.push(node);
      const list = byBareName.get(node.bareName) ?? [];
      list.push(node);
      byBareName.set(node.bareName, list);
    }
  }
  return { fns, byBareName, importedFilesByFile, totalCallSites };
}

export function findReachable(
  start: DataflowFunctionNode,
  index: DataflowFunctionIndex,
  predicate: (node: DataflowFunctionNode) => boolean,
  maxDepth: number,
): DataflowFunctionNode[] | null {
  type FrontierEntry = { node: DataflowFunctionNode; path: DataflowFunctionNode[] };
  const visited = new Set<string>([start.id]);
  let frontier: FrontierEntry[] = [{ node: start, path: [start] }];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: FrontierEntry[] = [];
    for (const entry of frontier) {
      for (const callee of entry.node.callees) {
        const targets = resolveCalleeTargets(entry.node, callee, index);
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

export function uniqueFiles(files: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file)) continue;
    seen.add(file);
    out.push(file);
  }
  return out;
}

export function compareDataflowRisks(a: DataflowRisk, b: DataflowRisk): number {
  const severityOrder = { error: 0, warning: 1 };
  const kindOrder = { direct: 0, bridge: 1, propagated: 2 };
  const severityDelta = severityOrder[a.severity] - severityOrder[b.severity];
  if (severityDelta !== 0) return severityDelta;
  const kindDelta = kindOrder[a.kind] - kindOrder[b.kind];
  if (kindDelta !== 0) return kindDelta;
  if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;
  return a.key.localeCompare(b.key);
}

function buildImportedFilesByFile(graph: CodeGraph): Map<string, Set<string>> {
  const importedFilesByFile = new Map<string, Set<string>>();
  for (const [target, importers] of graph.localImporters) {
    for (const importer of importers) {
      const targets = importedFilesByFile.get(importer) ?? new Set<string>();
      targets.add(target);
      importedFilesByFile.set(importer, targets);
    }
  }
  return importedFilesByFile;
}

function functionNode(
  file: string,
  graphFile: GraphFile,
  fn: FunctionInfo,
  sources: Set<string>,
  sinks: Set<string>,
  customSources: Set<string>,
  customSinks: Set<string>,
): DataflowFunctionNode {
  const callees = fn.callSites ?? [];
  const directCallSites = fn.directCallSites ?? [];
  const memberCallSites = fn.memberCallSites ?? [];
  const memberReferences = fn.memberReferences ?? [];
  const memberAliases = fn.memberAliases ?? [];
  const references = fn.references ?? [];
  const source =
    frameworkRequestSourceForFunction({
      file,
      functionName: fn.name,
      memberCallSites,
      memberReferences,
      parameters: fn.parameters ?? [],
      enabledSources: sources,
      references,
      contextualCallSite: fn.contextualCallSite,
      imports: graphFile.imports,
      directCallSites,
    }) ?? pickSourceHit(callees, references, sources, customSources);
  const sink = pickSinkHit(
    callees,
    directCallSites,
    memberCallSites,
    memberAliases,
    sinks,
    customSinks,
    file,
    graphFile,
  );
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

function resolveCalleeTargets(
  from: DataflowFunctionNode,
  callee: string,
  index: DataflowFunctionIndex,
): DataflowFunctionNode[] {
  const targets = index.byBareName.get(callee) ?? [];
  if (targets.length === 0) return [];

  const sameFile = targets.filter((target) => target.file === from.file);
  if (sameFile.length > 0) return sameFile;

  const importedFiles = index.importedFilesByFile.get(from.file);
  if (importedFiles) {
    const importedTargets = targets.filter((target) => importedFiles.has(target.file));
    if (importedTargets.length > 0) return importedTargets;
  }

  // Bare call names such as RegExp.exec, parse, get, run, and handler are
  // too collision-prone to join across the whole repository. Keep the
  // conservative global fallback for distinctive names only.
  if (isCollisionProneCallee(callee)) return [];
  return targets.length === 1 ? targets : [];
}

const COLLISION_PRONE_CALLEES = new Set([
  'add',
  'build',
  'check',
  'close',
  'compare',
  'create',
  'delete',
  'exec',
  'execute',
  'filter',
  'find',
  'get',
  'handle',
  'handler',
  'init',
  'load',
  'main',
  'map',
  'open',
  'parse',
  'read',
  'reduce',
  'remove',
  'resolve',
  'run',
  'save',
  'set',
  'start',
  'stop',
  'update',
  'validate',
  'write',
]);

function isCollisionProneCallee(callee: string): boolean {
  return COLLISION_PRONE_CALLEES.has(callee) || callee.length <= 2;
}

function pickSourceHit(
  callees: string[],
  references: string[],
  sources: Set<string>,
  customSources: Set<string>,
): string | null {
  for (const value of references) {
    if (customSources.has(value)) return value;
    if (sources.has(value) && !DEFAULT_HTTP_PROPERTY_SOURCES.has(value)) return value;
  }
  for (const value of callees) {
    if (customSources.has(value) || CALL_SHAPED_DEFAULT_SOURCES.has(value)) return value;
  }
  return null;
}

function pickSinkHit(
  callees: string[],
  directCallSites: string[],
  memberCallSites: string[],
  memberAliases: string[],
  sinks: Set<string>,
  customSinks: Set<string>,
  file: string,
  graphFile: { imports: Array<{ source: string; specifiers: string[] }>; adapterId?: string },
): string | null {
  for (const callee of callees) {
    if (!sinks.has(callee)) continue;
    if (
      isDefaultMisidentifiedDatabaseSink(
        callee,
        directCallSites,
        memberCallSites,
        memberAliases,
        customSinks,
        file,
        graphFile,
      )
    )
      continue;
    return callee;
  }
  return null;
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
