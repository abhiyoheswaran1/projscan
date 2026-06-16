import type { CodeGraph } from './codeGraph.js';
import {
  FRAMEWORK_REQUEST_SOURCES,
  frameworkRequestSourceForFunction,
} from './frameworkSources.js';

/**
 * Lightweight taint flow analysis (1.6+).
 *
 * Source-to-sink reachability over the existing per-function call
 * graph. Sources and sinks are *declared* by name (config-driven);
 * anything in between is treated as a function that might propagate
 * taint. We do NOT do general dataflow — we only ask "does some
 * call chain reach from a function that calls a source to a function
 * that calls a sink?"
 *
 * That heuristic catches the common case: a route handler reads
 * `process.env.SECRET` (source) and somewhere downstream it ends up
 * in `child_process.spawn` (sink). It misses any flow that goes
 * through code we can't see (eval'd strings, plugin loaders), and it
 * over-reports when functions read sources but launder them safely
 * before reaching sinks. Both are documented limitations.
 *
 * Legacy taint algorithm gap (1.6+): the "bridge-helper" pattern is missed —
 * `function bridge() { const v = getSecret(); runDangerous(v); }` where
 * `getSecret` reads the source and `runDangerous` is the sink. The BFS
 * walks DOWN from source-fns, but `bridge` has neither source nor sink
 * directly; both are its callees. 3.0's `computeDataflow` /
 * `projscan_dataflow` runs that second algorithm and review surfaces it
 * as `newDataflowRisks`. Keep this legacy function as the compatibility
 * source-to-sink reachability report.
 *
 * Strict scope discipline (per ROADMAP 1.6 guardrail): no CFG, no
 * variable-level dataflow, no AST inspection beyond what callSites
 * already gives us. If this drifts toward "general dataflow" cut it.
 */

export interface TaintConfig {
  /**
   * Bare callee names treated as taint sources. Examples:
   *   "process.env"        — environment variables (read sensitive config)
   *   "req.body"           — HTTP request body
   *   "readFileSync"       — disk read (could be user-controlled paths)
   *
   * Match is by bare name (the rightmost identifier in a member-access
   * chain). "process.env.SECRET" → "env"; "req.body.userId" → "body".
   * The default list captures the most common JS / Python / Go sources;
   * users override via .projscanrc taint.sources.
   */
  sources: string[];
  /**
   * Bare callee names treated as taint sinks. Examples:
   *   "exec"               — child_process.exec
   *   "spawn"              — child_process.spawn
   *   "writeFile"          — fs.writeFile
   *   "query"              — raw SQL (db.query("SELECT...${user}"))
   *   "eval"               — JS eval / Python eval / etc.
   */
  sinks: string[];
}

export const DEFAULT_TAINT_SOURCES: ReadonlyArray<string> = [
  'env', // process.env.X
  'argv', // process.argv
  'body', // req.body
  'query', // req.query — note: this clashes with sink "query"; sink wins by precedence
  'params', // req.params
  'headers', // req.headers
  'cookies', // req.cookies
  'readFile', // user-controlled paths
  'readFileSync',
  'stdin', // process.stdin
  'getInput', // common test/CLI input
  ...FRAMEWORK_REQUEST_SOURCES,
];

export const DEFAULT_TAINT_SINKS: ReadonlyArray<string> = [
  'exec', // child_process.exec
  'execSync',
  'spawn', // child_process.spawn
  'spawnSync',
  'eval', // global eval
  'Function', // new Function(string) — JS dynamic eval
  'writeFile', // fs.writeFile to user paths
  'writeFileSync',
  'unlink', // fs.unlink — destructive write
  'rmSync',
  'rm',
  'query', // raw SQL via db.query
  'execute', // raw SQL via db.execute
  'system', // os.system in Python
  'os.system',
  'subprocess', // python subprocess module
  'innerHTML', // DOM XSS — actually a property assignment, not a call;
  //             included only when call-shaped helpers wrap it (e.g. setInnerHtml).
];

const JAVASCRIPT_CHILD_PROCESS_SINKS = new Set(['exec', 'execSync', 'spawn', 'spawnSync']);
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
const CALL_SHAPED_DEFAULT_SOURCES = new Set(['getInput', 'readFile', 'readFileSync', 'stdin']);
const DEFAULT_HTTP_PROPERTY_SOURCES = new Set(['body', 'query', 'params', 'headers', 'cookies']);
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

export interface TaintFlow {
  /** Bare function name where the source was called. */
  sourceFn: string;
  /** Bare function name where the sink was called. */
  sinkFn: string;
  /** The source identifier (e.g. "env"). */
  source: string;
  /** The sink identifier (e.g. "exec"). */
  sink: string;
  /**
   * Sequence of fully-qualified function names from sourceFn to sinkFn,
   * inclusive at both ends. Length 1 means the same function reads the
   * source and calls the sink (the most direct flow).
   */
  path: string[];
  /** Files touched by the path (in order, deduped). */
  files: string[];
}

export interface TaintReport {
  available: boolean;
  reason?: string;
  flowCount: number;
  flows: TaintFlow[];
  /** The effective sources/sinks list used for this run (after merging defaults + config). */
  effectiveSources: string[];
  effectiveSinks: string[];
  /**
   * 1.8+ — true when the BFS hit MAX_DEPTH for at least one source with
   * a non-empty frontier still pending. When set, the agent should know
   * that flows deeper than MAX_DEPTH may exist but weren't reported.
   * Pairs with `truncatedSources` so a follow-up scan can re-target.
   */
  truncated?: boolean;
  /**
   * 1.8+ — function names whose BFS exited at MAX_DEPTH with the
   * frontier non-empty. Empty when no truncation occurred.
   */
  truncatedSources?: string[];
  /**
   * 1.8+ — the depth cap actually used. Surfacing this lets agents
   * notice when projscan's defaults shift between releases.
   */
  maxDepth?: number;
}

/**
 * Compute taint flows over the given code graph. Per-function callSites
 * are required (1.5+ ships these for every adapter); functions without
 * callSites can't be analyzed and are skipped.
 *
 * Algorithm:
 *   1. Build a function-name → {file, callees, hasSource, hasSink} index.
 *   2. For each function with hasSource=true, BFS its callees (and their
 *      callees, transitively) following the bare-name lookup, recording
 *      the path.
 *   3. When a hasSink=true function is reached, emit a TaintFlow.
 *   4. Deduplicate by (sourceFn, sinkFn).
 *
 * Same-function flows (sourceFn calls source AND sink in the same body)
 * are reported with path length 1.
 */
export function computeTaint(graph: CodeGraph, config: TaintConfig): TaintReport {
  const sources = new Set([...DEFAULT_TAINT_SOURCES, ...config.sources]);
  const sinks = new Set([...DEFAULT_TAINT_SINKS, ...config.sinks]);
  const customSources = new Set(config.sources);
  const customSinks = new Set(config.sinks);

  // Build function index. Key by the (file, name) pair to disambiguate
  // same-named methods on different classes; we project to bare-name
  // edges for the call-graph traversal.
  interface FnNode {
    id: string;
    qualName: string; // "Foo.bar" or "doIt"
    bareName: string; // "bar" or "doIt"
    file: string;
    callees: string[]; // bare names from the function's callSites
    references: string[]; // member-expression read idents (1.6+)
    memberReferences: string[]; // qualified member-expression reads, e.g. process.env.MY_CMD
    sourceHit: string | null;
    sinkHit: string | null;
    hasSource: boolean;
    hasSink: boolean;
  }

  const fnByQual = new Map<string, FnNode>();
  const fnsByBareName = new Map<string, FnNode[]>();
  let totalCallSites = 0;

  for (const [file, gf] of graph.files) {
    if (!gf.functions) continue;
    for (const fn of gf.functions) {
      const callees = fn.callSites ?? [];
      const directCallSites = fn.directCallSites ?? [];
      const memberCallSites = fn.memberCallSites ?? [];
      const memberReferences = fn.memberReferences ?? [];
      const memberAliases = fn.memberAliases ?? [];
      const references = fn.references ?? [];
      totalCallSites += callees.length;
      // Default sources mostly match property/reference reads; custom sources
      // may still be call-shaped. Sinks are call-shaped, so callSites only.
      const sourceHit =
        frameworkRequestSourceForFunction(
          file,
          fn.name,
          memberCallSites,
          memberReferences,
          fn.parameters ?? [],
          sources,
          references,
          fn.contextualCallSite,
          gf.imports,
        ) ?? pickSourceHit(callees, references, sources, customSources);
      const sinkHit = pickSinkHit(
        callees,
        directCallSites,
        memberCallSites,
        memberAliases,
        sinks,
        customSinks,
        file,
        gf,
      );
      const hasSource =
        sourceHit !== null &&
        !isDefaultChildProcessEnvPassthrough(
          sourceHit,
          sinkHit,
          memberReferences,
          customSources,
          customSinks,
        );
      const hasSink = sinkHit !== null;
      const node: FnNode = {
        id: `${file}::${fn.name}@${fn.line}`,
        qualName: fn.name,
        bareName: bareName(fn.name),
        file,
        callees,
        references,
        memberReferences,
        sourceHit,
        sinkHit,
        hasSource,
        hasSink,
      };
      fnByQual.set(node.id, node);
      let list = fnsByBareName.get(node.bareName);
      if (!list) {
        list = [];
        fnsByBareName.set(node.bareName, list);
      }
      list.push(node);
    }
  }

  if (fnByQual.size === 0 || totalCallSites === 0) {
    return {
      available: false,
      reason:
        'No functions with callSites in the graph. Taint requires per-function callSites (1.5+).',
      flowCount: 0,
      flows: [],
      effectiveSources: [...sources],
      effectiveSinks: [...sinks],
    };
  }

  const flows: TaintFlow[] = [];
  const seen = new Set<string>(); // dedupe key: sourceFnId::sinkFnId
  // 1.8+ — track which source functions hit MAX_DEPTH with frontier
  // still non-empty. The agent gets these in `truncatedSources` so it
  // knows where the analysis was clipped.
  const truncatedSources: string[] = [];
  // 1.8+ — raised from 8 → 12. The original 8 was a conservative pick
  // when the algorithm was new; six months of dogfood data show real
  // user repos averaging 10–11 hops between an HTTP handler and a
  // shell-exec sink. 12 catches those without exploding fan-out
  // memory in the BFS frontier.
  const MAX_DEPTH = 12;
  // 1.10+ — per-step frontier cap. MAX_DEPTH bounds path length, but
  // wide-fan-out graphs (Java/TS with prevalent get/set/toString bare-name
  // collisions) can balloon the frontier exponentially: each step
  // resolves every bare-name callee to every same-named function in the
  // graph. Once a single step would push past this cap, we abort the
  // remaining BFS for this source and surface it in `truncatedSources`,
  // matching how MAX_DEPTH truncation is reported.
  const MAX_FRONTIER_PER_STEP = 5000;

  for (const sourceFn of fnByQual.values()) {
    if (!sourceFn.hasSource) continue;
    // Same-function shortcut.
    if (sourceFn.hasSink) {
      const key = `${sourceFn.id}::${sourceFn.id}`;
      if (!seen.has(key)) {
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
    }
    // BFS through callees.
    const visited = new Set<string>([sourceFn.id]);
    type FrontierEntry = { node: FnNode; path: FnNode[] };
    let frontier: FrontierEntry[] = [{ node: sourceFn, path: [sourceFn] }];
    let depth = 0;
    let frontierCapped = false;
    while (frontier.length > 0 && depth < MAX_DEPTH) {
      depth += 1;
      const next: FrontierEntry[] = [];
      let aborted = false;
      for (const entry of frontier) {
        if (aborted) break;
        for (const calleeName of entry.node.callees) {
          const candidates = fnsByBareName.get(calleeName) ?? [];
          for (const candidate of candidates) {
            if (visited.has(candidate.id)) continue;
            visited.add(candidate.id);
            const newPath = [...entry.path, candidate];
            if (candidate.hasSink) {
              const flowKey = `${sourceFn.id}::${candidate.id}`;
              if (!seen.has(flowKey)) {
                seen.add(flowKey);
                const filesInPath: string[] = [];
                for (const n of newPath) {
                  if (filesInPath[filesInPath.length - 1] !== n.file) filesInPath.push(n.file);
                }
                flows.push({
                  sourceFn: sourceFn.qualName,
                  sinkFn: candidate.qualName,
                  source: sourceFn.sourceHit!,
                  sink: candidate.sinkHit!,
                  path: newPath.map((n) => n.qualName),
                  files: filesInPath,
                });
              }
              // Don't continue past a sink — the flow is reported.
              continue;
            }
            next.push({ node: candidate, path: newPath });
            if (next.length >= MAX_FRONTIER_PER_STEP) {
              // 1.10+ — per-step frontier cap reached. Abort this source's
              // BFS and surface it as truncated. Continuing would just
              // multiply: each entry in `next` will spawn its own bare-name
              // resolutions on the following step.
              frontierCapped = true;
              aborted = true;
              break;
            }
          }
          if (aborted) break;
        }
      }
      frontier = next;
    }
    // If the BFS exited because of MAX_DEPTH or the per-step frontier cap
    // (not because the frontier emptied), record the source so the caller
    // knows flows beyond that point weren't explored.
    if (frontier.length > 0 || frontierCapped) {
      truncatedSources.push(sourceFn.qualName);
    }
  }

  flows.sort((a, b) => {
    if (a.sourceFn !== b.sourceFn) return a.sourceFn.localeCompare(b.sourceFn);
    return a.sinkFn.localeCompare(b.sinkFn);
  });

  return {
    available: true,
    flowCount: flows.length,
    flows,
    effectiveSources: [...sources].sort(),
    effectiveSinks: [...sinks].sort(),
    truncated: truncatedSources.length > 0,
    truncatedSources: [...new Set(truncatedSources)].sort(),
    maxDepth: MAX_DEPTH,
  };
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
    if (isDefaultMisidentifiedJavaScriptShellSink(callee, customSinks, file, graphFile)) continue;
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

function isDefaultMisidentifiedJavaScriptShellSink(
  callee: string,
  customSinks: Set<string>,
  file: string,
  graphFile: { imports: Array<{ source: string; specifiers: string[] }>; adapterId?: string },
): boolean {
  if (customSinks.has(callee)) return false;
  if (!JAVASCRIPT_CHILD_PROCESS_SINKS.has(callee)) return false;
  if (!isJavaScriptLikeFile(file, graphFile.adapterId)) return false;
  return !graphFile.imports.some(
    (imp) =>
      (imp.source === 'node:child_process' || imp.source === 'child_process') &&
      (imp.specifiers.includes(callee) || imp.specifiers.length === 0),
  );
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
  if (dot < 0) return qualified;
  return qualified.slice(dot + 1);
}

function isDefaultChildProcessEnvPassthrough(
  sourceHit: string,
  sinkHit: string | null,
  memberReferences: string[],
  customSources: Set<string>,
  customSinks: Set<string>,
): boolean {
  if (sourceHit !== 'env') return false;
  if (!sinkHit || !JAVASCRIPT_CHILD_PROCESS_SINKS.has(sinkHit)) return false;
  if (customSources.has(sourceHit) || customSinks.has(sinkHit)) return false;
  return (
    memberReferences.includes('process.env') &&
    !memberReferences.some((reference) => reference.startsWith('process.env.'))
  );
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
