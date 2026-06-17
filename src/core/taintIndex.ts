import type { CodeGraph, GraphFile } from './codeGraph.js';
import { frameworkRequestSourceForFunction } from './frameworkSources.js';
import {
  isDefaultChildProcessEnvPassthrough,
  pickSinkHit,
  pickSourceHit,
} from './taintMatching.js';

export interface TaintFunctionNode {
  id: string;
  qualName: string;
  bareName: string;
  file: string;
  callees: string[];
  references: string[];
  memberReferences: string[];
  sourceHit: string | null;
  sinkHit: string | null;
  hasSource: boolean;
  hasSink: boolean;
}

export interface TaintFunctionIndex {
  fnByQual: Map<string, TaintFunctionNode>;
  fnsByBareName: Map<string, TaintFunctionNode[]>;
  totalCallSites: number;
}

type GraphFunction = NonNullable<GraphFile['functions']>[number];
const EMPTY_STRING_ARRAY: string[] = [];

export function buildTaintFunctionIndex(
  graph: CodeGraph,
  sources: Set<string>,
  sinks: Set<string>,
  customSources: Set<string>,
  customSinks: Set<string>,
): TaintFunctionIndex {
  const fnByQual = new Map<string, TaintFunctionNode>();
  const fnsByBareName = new Map<string, TaintFunctionNode[]>();
  let totalCallSites = 0;

  for (const [file, graphFile] of graph.files) {
    if (!graphFile.functions) continue;
    for (const fn of graphFile.functions) {
      const node = buildTaintFunctionNode(
        file,
        graphFile,
        fn,
        sources,
        sinks,
        customSources,
        customSinks,
      );
      totalCallSites += node.callees.length;
      fnByQual.set(node.id, node);
      appendByBareName(fnsByBareName, node);
    }
  }

  return { fnByQual, fnsByBareName, totalCallSites };
}

function buildTaintFunctionNode(
  file: string,
  graphFile: GraphFile,
  fn: GraphFunction,
  sources: Set<string>,
  sinks: Set<string>,
  customSources: Set<string>,
  customSinks: Set<string>,
): TaintFunctionNode {
  const callees = optionalArray(fn.callSites);
  const directCallSites = optionalArray(fn.directCallSites);
  const memberCallSites = optionalArray(fn.memberCallSites);
  const memberReferences = optionalArray(fn.memberReferences);
  const memberAliases = optionalArray(fn.memberAliases);
  const references = optionalArray(fn.references);
  const sourceHit = resolveSourceHit(
    file,
    graphFile,
    fn,
    callees,
    directCallSites,
    memberCallSites,
    memberReferences,
    references,
    sources,
    customSources,
  );
  const sinkHit = resolveSinkHit(
    file,
    graphFile,
    callees,
    directCallSites,
    memberCallSites,
    memberAliases,
    sinks,
    customSinks,
  );

  return {
    id: `${file}::${fn.name}@${fn.line}`,
    qualName: fn.name,
    bareName: bareName(fn.name),
    file,
    callees,
    references,
    memberReferences,
    sourceHit,
    sinkHit,
    hasSource: isActiveSourceHit(sourceHit, sinkHit, memberReferences, customSources, customSinks),
    hasSink: sinkHit !== null,
  };
}

function resolveSourceHit(
  file: string,
  graphFile: GraphFile,
  fn: GraphFunction,
  callees: string[],
  directCallSites: string[],
  memberCallSites: string[],
  memberReferences: string[],
  references: string[],
  sources: Set<string>,
  customSources: Set<string>,
): string | null {
  return (
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
    }) ?? pickSourceHit(callees, references, sources, customSources)
  );
}

function resolveSinkHit(
  file: string,
  graphFile: GraphFile,
  callees: string[],
  directCallSites: string[],
  memberCallSites: string[],
  memberAliases: string[],
  sinks: Set<string>,
  customSinks: Set<string>,
): string | null {
  return pickSinkHit(
    callees,
    directCallSites,
    memberCallSites,
    memberAliases,
    sinks,
    customSinks,
    file,
    graphFile,
  );
}

function isActiveSourceHit(
  sourceHit: string | null,
  sinkHit: string | null,
  memberReferences: string[],
  customSources: Set<string>,
  customSinks: Set<string>,
): boolean {
  return (
    sourceHit !== null &&
    !isDefaultChildProcessEnvPassthrough(
      sourceHit,
      sinkHit,
      memberReferences,
      customSources,
      customSinks,
    )
  );
}

function appendByBareName(
  fnsByBareName: Map<string, TaintFunctionNode[]>,
  node: TaintFunctionNode,
): void {
  const existing = fnsByBareName.get(node.bareName);
  if (existing) {
    existing.push(node);
    return;
  }
  fnsByBareName.set(node.bareName, [node]);
}

function optionalArray(values: string[] | undefined): string[] {
  return values ?? EMPTY_STRING_ARRAY;
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  if (dot < 0) return qualified;
  return qualified.slice(dot + 1);
}
