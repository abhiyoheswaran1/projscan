import type { CodeGraph } from './codeGraph.js';
import { FRAMEWORK_REQUEST_SOURCES } from './frameworkSources.js';
import { buildTaintFunctionIndex } from './taintIndex.js';
import { findTaintFlows } from './taintTraversal.js';
import type { TaintConfig, TaintReport } from './taintTypes.js';

export type { TaintConfig, TaintFlow, TaintReport } from './taintTypes.js';

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
  const index = buildTaintFunctionIndex(graph, sources, sinks, customSources, customSinks);

  if (index.fnByQual.size === 0 || index.totalCallSites === 0) {
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

  const traversal = findTaintFlows(index);

  return {
    available: true,
    flowCount: traversal.flows.length,
    flows: traversal.flows,
    effectiveSources: [...sources].sort(),
    effectiveSinks: [...sinks].sort(),
    truncated: traversal.truncatedSources.length > 0,
    truncatedSources: traversal.truncatedSources,
    maxDepth: traversal.maxDepth,
  };
}
