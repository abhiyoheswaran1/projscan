import type { CodeGraph } from './codeGraph.js';

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
 * Known algorithm gap (1.6+): the "bridge-helper" pattern is missed —
 * `function bridge() { const v = getSecret(); runDangerous(v); }` where
 * `getSecret` reads the source and `runDangerous` is the sink. The BFS
 * walks DOWN from source-fns, but `bridge` has neither source nor sink
 * directly; both are its callees. Detecting this needs a different
 * algorithm (per-fn "transitively calls a source AND transitively calls
 * a sink") — deferred. Workaround: declare the helper itself as a
 * source via .projscanrc.json `taint.sources`.
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

  // Build function index. Key by the (file, name) pair to disambiguate
  // same-named methods on different classes; we project to bare-name
  // edges for the call-graph traversal.
  interface FnNode {
    qualName: string; // "Foo.bar" or "doIt"
    bareName: string; // "bar" or "doIt"
    file: string;
    callees: string[]; // bare names from the function's callSites
    references: string[]; // member-expression read idents (1.6+)
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
      const references = fn.references ?? [];
      totalCallSites += callees.length;
      // Sources match callSites OR references (covers `process.env.X`-style
      // property reads). Sinks are call-shaped, so callSites only.
      const hasSource =
        callees.some((c) => sources.has(c)) || references.some((r) => sources.has(r));
      const hasSink = callees.some((c) => sinks.has(c));
      const node: FnNode = {
        qualName: fn.name,
        bareName: bareName(fn.name),
        file,
        callees,
        references,
        hasSource,
        hasSink,
      };
      fnByQual.set(`${file}::${fn.name}`, node);
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
  const seen = new Set<string>(); // dedupe key: sourceFnQual::sinkFnQual

  for (const sourceFn of fnByQual.values()) {
    if (!sourceFn.hasSource) continue;
    // Same-function shortcut.
    if (sourceFn.hasSink) {
      const key = `${sourceFn.file}::${sourceFn.qualName}::${sourceFn.file}::${sourceFn.qualName}`;
      if (!seen.has(key)) {
        seen.add(key);
        flows.push({
          sourceFn: sourceFn.qualName,
          sinkFn: sourceFn.qualName,
          source: pickHit([...sourceFn.callees, ...sourceFn.references], sources)!,
          sink: pickHit(sourceFn.callees, sinks)!,
          path: [sourceFn.qualName],
          files: [sourceFn.file],
        });
      }
    }
    // BFS through callees.
    const visited = new Set<string>([`${sourceFn.file}::${sourceFn.qualName}`]);
    type FrontierEntry = { node: FnNode; path: FnNode[] };
    let frontier: FrontierEntry[] = [{ node: sourceFn, path: [sourceFn] }];
    let depth = 0;
    const MAX_DEPTH = 8;
    while (frontier.length > 0 && depth < MAX_DEPTH) {
      depth += 1;
      const next: FrontierEntry[] = [];
      for (const entry of frontier) {
        for (const calleeName of entry.node.callees) {
          const candidates = fnsByBareName.get(calleeName) ?? [];
          for (const candidate of candidates) {
            const key = `${candidate.file}::${candidate.qualName}`;
            if (visited.has(key)) continue;
            visited.add(key);
            const newPath = [...entry.path, candidate];
            if (candidate.hasSink) {
              const flowKey = `${sourceFn.file}::${sourceFn.qualName}::${candidate.file}::${candidate.qualName}`;
              if (!seen.has(flowKey)) {
                seen.add(flowKey);
                const filesInPath: string[] = [];
                for (const n of newPath) {
                  if (filesInPath[filesInPath.length - 1] !== n.file) filesInPath.push(n.file);
                }
                flows.push({
                  sourceFn: sourceFn.qualName,
                  sinkFn: candidate.qualName,
                  source: pickHit([...sourceFn.callees, ...sourceFn.references], sources)!,
                  sink: pickHit(candidate.callees, sinks)!,
                  path: newPath.map((n) => n.qualName),
                  files: filesInPath,
                });
              }
              // Don't continue past a sink — the flow is reported.
              continue;
            }
            next.push({ node: candidate, path: newPath });
          }
        }
      }
      frontier = next;
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
  };
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  if (dot < 0) return qualified;
  return qualified.slice(dot + 1);
}

function pickHit(callees: string[], set: Set<string>): string | null {
  for (const c of callees) if (set.has(c)) return c;
  return null;
}
