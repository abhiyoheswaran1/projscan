import type { FunctionInfo } from './ast.js';
import type { CodeGraph, GraphFile } from './codeGraph.js';
import { shouldIncludeDataflowRisk, type DataflowRiskFilterContext } from './dataflowFilters.js';
import { frameworkRequestSourceForFunction } from './frameworkSources.js';
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
  importedFilesByFile: Map<string, Set<string>>;
  totalCallSites: number;
}

const DEFAULT_MAX_DEPTH = 12;
const CALL_SHAPED_DEFAULT_SOURCES = new Set(['getInput', 'readFile', 'readFileSync', 'stdin']);
const DEFAULT_HTTP_PROPERTY_SOURCES = new Set(['body', 'query', 'params', 'headers', 'cookies']);

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
  customSources: Set<string>,
  customSinks: Set<string>,
): FnIndex {
  const fns: FnNode[] = [];
  const byBareName = new Map<string, FnNode[]>();
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
): FnNode {
  const callees = fn.callSites ?? [];
  const directCallSites = fn.directCallSites ?? [];
  const memberCallSites = fn.memberCallSites ?? [];
  const memberAliases = fn.memberAliases ?? [];
  const references = fn.references ?? [];
  const source =
    frameworkRequestSourceForFunction(
      file,
      fn.name,
      memberCallSites,
      fn.parameters ?? [],
      sources,
      references,
      fn.contextualCallSite,
      graphFile.imports,
    ) ?? pickSourceHit(callees, references, sources, customSources);
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

function resolveCalleeTargets(from: FnNode, callee: string, index: FnIndex): FnNode[] {
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

const DEFAULT_DATABASE_SINKS = new Set(['query', 'execute', '$queryRaw', '$executeRaw', 'raw']);
const DATABASE_RECEIVERS = new Set([
  'db',
  'database',
  'pool',
  'client',
  'connection',
  'conn',
  'prisma',
  'knex',
  'sequelize',
  'repository',
  'repo',
  'manager',
  'sql',
]);
const DATABASE_MODULE_NAMES = new Set([
  'db',
  'database',
  'sql',
  'pool',
  'client',
  'repository',
  'repo',
]);
const KNOWN_DATABASE_PACKAGES = new Set([
  'pg',
  'postgres',
  'mysql',
  'mysql2',
  'sqlite3',
  'better-sqlite3',
  'knex',
  'sequelize',
  '@prisma/client',
]);

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

function isDefaultMisidentifiedDatabaseSink(
  callee: string,
  directCallSites: string[],
  memberCallSites: string[],
  memberAliases: string[],
  customSinks: Set<string>,
  file: string,
  graphFile: { imports: Array<{ source: string; specifiers: string[] }>; adapterId?: string },
): boolean {
  if (customSinks.has(callee)) return false;
  if (!DEFAULT_DATABASE_SINKS.has(callee)) return false;
  if (!isJavaScriptLikeFile(file, graphFile.adapterId)) return false;
  if (memberCallSites.some((member) => isDatabaseMemberCall(member, callee))) return false;
  if (directCallSites.includes(callee) && isImportedDatabaseHelper(callee, graphFile.imports))
    return false;
  if (
    directCallSites.includes(callee) &&
    memberAliases.some((alias) => isDatabaseMemberAlias(alias, callee))
  )
    return false;
  return true;
}

function isDatabaseMemberCall(member: string, callee: string): boolean {
  const parts = member.split('.');
  if (parts[parts.length - 1] !== callee) return false;
  const receiver = parts.length >= 2 ? parts[parts.length - 2].toLowerCase() : '';
  return DATABASE_RECEIVERS.has(receiver);
}

function isImportedDatabaseHelper(
  callee: string,
  imports: Array<{ source: string; specifiers: string[] }>,
): boolean {
  return imports.some((imp) => imp.specifiers.includes(callee) && isDatabaseModule(imp.source));
}

function isDatabaseModule(source: string): boolean {
  if (KNOWN_DATABASE_PACKAGES.has(source)) return true;
  const normalized = source.replace(/\\/g, '/');
  const last = normalized.split('/').pop() ?? normalized;
  const basename = last.replace(/\.(?:c|m)?(?:j|t)sx?$/i, '').toLowerCase();
  return DATABASE_MODULE_NAMES.has(basename);
}

function isDatabaseMemberAlias(alias: string, callee: string): boolean {
  const [localName, member] = alias.split('=');
  return localName === callee && isDatabaseMemberCall(member ?? '', callee);
}

function isJavaScriptLikeFile(file: string, adapterId?: string): boolean {
  return adapterId === 'javascript' || /\.(?:cjs|mjs|js|jsx|ts|tsx)$/.test(file);
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
