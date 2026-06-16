import { computeReview } from '../../core/review.js';
import type { ReviewReport } from '../../types/review.js';
import type { McpTool, McpToolContext } from './_shared.js';

/**
 * 1.8+ — `projscan_review_watch`. Long-running PR-watch mode that
 * complements `projscan_review` (one-shot snapshot). Subscribe-once-
 * watch-forever closes the long-session loop on PRs the way file
 * `--watch` (1.3) did for source files: agents can pin a PR, react to
 * pushes as they happen, and avoid re-running review on every turn.
 *
 * Subactions:
 *   - "start"  : begin polling. Returns the initial review payload AND
 *                a `watchId` the caller persists.
 *   - "stop"   : cancel a watch by id.
 *   - "list"   : enumerate active watches in this server's session.
 *
 * Polling: every `interval_seconds` (default 30, min 5, max 600) the
 * server re-runs computeReview against the same base+head pair. If the
 * result's `signature` (verdict + base/head SHA + flow count + risky-
 * function-name set) differs from the previous tick, it emits a
 * `notifications/projscan/pr_changed` notification with the new full
 * report inline. Successive ticks with the same signature are silent.
 *
 * Notification flow (sent over the JSON-RPC notify channel):
 *
 *   { method: "notifications/projscan/pr_changed",
 *     params: { watchId, base, head, baseSha, headSha, report } }
 *
 * Lifecycle: the server holds the cancel handle in `toolWatches`. On
 * close() (process exit, EOF on stdin) all watches are cancelled. Tool
 * results, including the watch itself, are best-effort: if computeReview
 * fails on a tick, the failure is logged via the same notification
 * channel with a `pr_review_error` method instead of `pr_changed`.
 */

interface WatchSnapshot {
  /** 1.8+ */
  verdict: string;
  baseSha: string | null;
  headSha: string | null;
  changedFilesCount: number;
  taintFlowKeys: string[];
  riskyFunctionKeys: string[];
  /**
   * 1.9+ — deepened signature. Each cycle is fingerprinted by its
   * sorted file list so we can tell newly-introduced cycles apart from
   * stable ones across ticks.
   */
  cycleKeys: string[];
  /**
   * 1.9+ — dependency-change fingerprint per (manifest, name, kind).
   * 'add'/'remove' carry the version; 'bump' carries from->to.
   * Allows the delta to count adds/removes/bumps separately.
   */
  depAdds: string[];
  depRemoves: string[];
  depBumps: string[];
}

interface WatchDelta {
  /**
   * 1.9+ — which buckets actually changed since last tick. Lets the
   * agent decide whether to refetch full data or just react to one
   * dimension (e.g. only `deps` triggered, so re-run audit not review).
   */
  changeKinds: Array<
    'verdict' | 'baseSha' | 'headSha' | 'changedFiles' | 'cycles' | 'risky' | 'taint' | 'deps'
  >;
  cycles: { added: number; removed: number };
  risky: { added: number; removed: number };
  taint: { added: number; removed: number };
  deps: { added: number; removed: number; bumped: number };
}

interface WatchState {
  watchId: string;
  base: string;
  head: string;
  intervalMs: number;
  startedAt: string;
  ticks: number;
  lastSignature: string | null;
  /** 1.9+ — kept alongside lastSignature so we can compute deltas at notification time. */
  lastSnapshot: WatchSnapshot | null;
  lastReportAt: string | null;
  /**
   * 1.8+ — guard against concurrent runTick calls from overlapping
   * setInterval firings when computeReview is slow (large repo, slow
   * git). Only one tick runs at a time per watch; subsequent timers
   * that fire while one is in flight are dropped, NOT queued — the
   * next tick will pick up whatever the latest state is.
   */
  inFlight: boolean;
}

const watches = new Map<string, WatchState>();
const DEFAULT_INTERVAL_S = 30;
const MIN_INTERVAL_S = 5;
const MAX_INTERVAL_S = 600;

export const reviewWatchTool: McpTool = {
  name: 'projscan_review_watch',
  description:
    'Long-running PR review. Polls a base+head ref pair on an interval and emits a notifications/projscan/pr_changed notification whenever the review verdict, SHAs, cycle set, dep changes, taint flows, or risky-function set changes. 1.9+: the notification carries a structured `delta` describing exactly which buckets moved (verdict/baseSha/headSha/changedFiles/cycles/risky/taint/deps) and counts of newly-appearing items per bucket, so agents can skip work they do not need. Pairs with projscan_review (one-shot) — use this when an agent wants to react to pushes on a PR without re-asking. Actions: start (returns initial review + watchId) / stop / list.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'stop', 'list'],
        description:
          '"start" begins polling (returns initial review + watchId). "stop" cancels a watch by id. "list" enumerates active watches.',
      },
      base: {
        type: 'string',
        description:
          'Base ref. Default: origin/main → main → origin/master → master → HEAD~1. (start only)',
      },
      head: {
        type: 'string',
        description: 'Head ref. Default: HEAD. (start only)',
      },
      interval_seconds: {
        type: 'number',
        description: `Poll interval in seconds. Default: ${DEFAULT_INTERVAL_S}. Min: ${MIN_INTERVAL_S}, max: ${MAX_INTERVAL_S}. (start only)`,
      },
      watchId: {
        type: 'string',
        description: 'Watch identifier returned by a previous "start". (stop only)',
      },
    },
  },
  handler: async (args, rootPath, context) => {
    const action = typeof args.action === 'string' ? args.action : 'start';
    if (action === 'list') return listWatches();
    if (action === 'stop') return stopWatch(args, context);
    if (action === 'start') return startWatch(args, rootPath, context);
    throw new Error(`Unknown action "${action}". Valid actions: start, stop, list.`);
  },
};

async function startWatch(
  args: Record<string, unknown>,
  rootPath: string,
  context: McpToolContext | undefined,
): Promise<unknown> {
  const base = typeof args.base === 'string' && args.base ? args.base : undefined;
  const head = typeof args.head === 'string' && args.head ? args.head : undefined;
  const requestedInterval =
    typeof args.interval_seconds === 'number' && Number.isFinite(args.interval_seconds)
      ? args.interval_seconds
      : DEFAULT_INTERVAL_S;
  const intervalSeconds = clamp(requestedInterval, MIN_INTERVAL_S, MAX_INTERVAL_S);
  const intervalMs = Math.round(intervalSeconds * 1000);

  // Initial review — synchronous, returned with the response so the agent
  // gets a useful payload right away and can react before the first tick.
  const initial = await computeReview(rootPath, { base, head });
  const initialSnapshot = snapshotOf(initial);
  const initialSignature = signatureOf(initialSnapshot);

  if (!context?.registerWatch || !context.notify) {
    // Caller is in a transport without a notify channel (CLI smoke,
    // tests). Return the initial review with a clear note that no
    // watch is registered, instead of silently dropping the request.
    return {
      action: 'start',
      watchId: null,
      registered: false,
      reason:
        'No notify channel — server was started without one (or this is a non-MCP caller). Initial review attached; subscribe to the MCP notify channel to receive incremental updates.',
      base: initial.base?.ref ?? base ?? null,
      head: initial.head?.ref ?? head ?? null,
      intervalSeconds,
      report: initial,
    };
  }

  // 1.8+ — register FIRST so we have a stable watchId, then arm the
  // timer. The previous order (timer first, watchId set second)
  // captured a `null` watchId in the tick closure for a brief window;
  // it would never have fired in that window (intervalMs >= 5000ms)
  // but the order is fragile and easy to break under refactor.
  //
  // Use crypto.randomUUID() inside the server's registerWatch so
  // collisions under burst (1000 starts in 1ms) are impossible — the
  // older `Math.random().toString(36)` shape was 36^8 ≈ 2.8T values,
  // good in practice but not guaranteed.
  let timer: ReturnType<typeof setInterval> | null = null;
  const watchId = context.registerWatch(() => {
    if (timer) clearInterval(timer);
    timer = null;
    watches.delete(watchId);
  });

  watches.set(watchId, {
    watchId,
    base: base ?? '(default)',
    head: head ?? 'HEAD',
    intervalMs,
    startedAt: new Date().toISOString(),
    ticks: 0,
    lastSignature: initialSignature,
    lastSnapshot: initialSnapshot,
    lastReportAt: new Date().toISOString(),
    inFlight: false,
  });

  const tick = (): void => {
    void runTick(rootPath, watchId, base, head, context);
  };
  timer = setInterval(tick, intervalMs);
  // Don't keep the process alive for a polling interval alone — if the
  // caller exits stdin, close() will fire and clear this. unref so a
  // dangling watch doesn't block process exit in tests. Safe in
  // production: the MCP server's own stdin/stdout I/O keeps the
  // process alive; close() (driven by stdin EOF) clears the timer.
  if (typeof timer.unref === 'function') timer.unref();

  return {
    action: 'start',
    watchId,
    registered: true,
    base: initial.base?.ref ?? base ?? null,
    head: initial.head?.ref ?? head ?? null,
    intervalSeconds,
    report: initial,
  };
}

async function runTick(
  rootPath: string,
  watchId: string,
  base: string | undefined,
  head: string | undefined,
  context: McpToolContext,
): Promise<void> {
  const state = watches.get(watchId);
  if (!state) return; // already cancelled
  // 1.8+ — single-flight guard. If a previous tick is still computing
  // (slow git, large repo, network-bound worktree fetch), drop this
  // one rather than queue. Notification ordering matters more than
  // not-missing-an-update: the next tick picks up the latest state.
  if (state.inFlight) return;
  state.inFlight = true;
  state.ticks += 1;

  try {
    let report: ReviewReport;
    try {
      report = await computeReview(rootPath, { base, head });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.notify?.('notifications/projscan/pr_review_error', { watchId, error: message });
      return;
    }

    const snapshot = snapshotOf(report);
    const sig = signatureOf(snapshot);
    if (sig === state.lastSignature) return; // unchanged — silent
    // 1.9+ — diff against the previous snapshot so the notification
    // tells the agent *what kind* of change triggered it. Lets the
    // agent skip work it doesn't need: e.g. dep-only changes don't
    // need a full review re-read; verdict changes do.
    const delta = diffSnapshots(state.lastSnapshot, snapshot);
    state.lastSignature = sig;
    state.lastSnapshot = snapshot;
    state.lastReportAt = new Date().toISOString();
    context.notify?.('notifications/projscan/pr_changed', {
      watchId,
      base: report.base?.ref ?? base ?? null,
      head: report.head?.ref ?? head ?? null,
      baseSha: report.base?.resolvedSha ?? null,
      headSha: report.head?.resolvedSha ?? null,
      delta,
      report,
    });
  } finally {
    // Always clear the in-flight flag, even when the tick threw or
    // returned early — otherwise a single failure orphans the watch.
    state.inFlight = false;
  }
}

function stopWatch(args: Record<string, unknown>, context: McpToolContext | undefined): unknown {
  const watchId = typeof args.watchId === 'string' ? args.watchId : '';
  if (!watchId) throw new Error('stop action requires a "watchId" argument');
  // 1.8+ — always remove from `watches` regardless of whether the
  // server's registry knew about it. The previous shape only deleted
  // on context.unregisterWatch success, leaking module-level state
  // when callers stopped a watch via a different transport (or in
  // tests without a context). The cancel callback registered by
  // start ALSO deletes the entry, so this is idempotent.
  const watchExisted = watches.has(watchId);
  watches.delete(watchId);
  const cancelled = context?.unregisterWatch ? context.unregisterWatch(watchId) : false;
  return {
    action: 'stop',
    watchId,
    cancelled: cancelled || watchExisted,
    watchNotFound: !watchExisted && !cancelled,
  };
}

function listWatches(): unknown {
  return {
    action: 'list',
    count: watches.size,
    watches: [...watches.values()].map((w) => ({
      watchId: w.watchId,
      base: w.base,
      head: w.head,
      intervalMs: w.intervalMs,
      startedAt: w.startedAt,
      ticks: w.ticks,
      lastReportAt: w.lastReportAt,
    })),
  };
}

/**
 * 1.9+ — Capture the change-detection-relevant slice of a review.
 * Replaces 1.8's `signatureOf(report) → string` so we can both compare
 * ticks for equality AND compute a structured delta when they differ.
 *
 * Cycles use a sorted-files fingerprint, dependency changes are split
 * into adds / removes / bumps. Risky-function keys carry both file and
 * name so renames in unchanged files surface, and so two functions
 * with the same anonymous name in different files don't collapse.
 */
function snapshotOf(report: ReviewReport): WatchSnapshot {
  const cycleKeys = (report.newCycles ?? []).map((c) => [...c.files].sort().join('|')).sort();
  const taintFlowKeys = (report.newTaintFlows ?? [])
    .map((f) => `${f.sourceFn}::${f.sinkFn}`)
    .sort();
  const riskyFunctionKeys = (report.riskyFunctions ?? []).map((f) => `${f.file}::${f.name}`).sort();
  const depAdds: string[] = [];
  const depRemoves: string[] = [];
  const depBumps: string[] = [];
  for (const change of report.dependencyChanges ?? []) {
    for (const a of change.added) {
      depAdds.push(`${change.manifestFile}::${a.name}::${a.kind}::${a.version}`);
    }
    for (const r of change.removed) {
      depRemoves.push(`${change.manifestFile}::${r.name}::${r.kind}::${r.version}`);
    }
    for (const b of change.bumped) {
      depBumps.push(`${change.manifestFile}::${b.name}::${b.kind}::${b.from}->${b.to}`);
    }
  }
  depAdds.sort();
  depRemoves.sort();
  depBumps.sort();
  return {
    verdict: report.verdict ?? '',
    baseSha: report.base?.resolvedSha ?? null,
    headSha: report.head?.resolvedSha ?? null,
    changedFilesCount: report.changedFiles?.length ?? 0,
    taintFlowKeys,
    riskyFunctionKeys,
    cycleKeys,
    depAdds,
    depRemoves,
    depBumps,
  };
}

/**
 * Serialize a snapshot into a stable comparison key. Used only for
 * the fast "did anything change?" check — the structured delta is
 * computed separately via diffSnapshots.
 */
function signatureOf(snapshot: WatchSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * 1.9+ — Structured diff between two watch snapshots. Counts items
 * that moved into or out of each bucket, and records which buckets
 * had any change at all. Caller embeds this in the `delta` field of
 * the `notifications/projscan/pr_changed` payload so agents can react
 * to a specific dimension without re-reading the full report.
 *
 * `prev` may be null for the very first emitted notification — in
 * that case every non-empty bucket is reported as an "added" delta
 * against an empty baseline.
 */
function diffSnapshots(prev: WatchSnapshot | null, next: WatchSnapshot): WatchDelta {
  const prevCycles = new Set(prev?.cycleKeys ?? []);
  const nextCycles = new Set(next.cycleKeys);
  const prevTaint = new Set(prev?.taintFlowKeys ?? []);
  const nextTaint = new Set(next.taintFlowKeys);
  const prevRisky = new Set(prev?.riskyFunctionKeys ?? []);
  const nextRisky = new Set(next.riskyFunctionKeys);
  const prevDepAdds = new Set(prev?.depAdds ?? []);
  const nextDepAdds = new Set(next.depAdds);
  const prevDepRemoves = new Set(prev?.depRemoves ?? []);
  const nextDepRemoves = new Set(next.depRemoves);
  const prevDepBumps = new Set(prev?.depBumps ?? []);
  const nextDepBumps = new Set(next.depBumps);

  const cycles = setDiffCounts(prevCycles, nextCycles);
  const taint = setDiffCounts(prevTaint, nextTaint);
  const risky = setDiffCounts(prevRisky, nextRisky);
  const depAddsDiff = setDiffCounts(prevDepAdds, nextDepAdds);
  const depRemovesDiff = setDiffCounts(prevDepRemoves, nextDepRemoves);
  const depBumpsDiff = setDiffCounts(prevDepBumps, nextDepBumps);
  // Each dep-bucket counter reports records that NEWLY appeared. We
  // intentionally don't roll up reverts (records that vanished from a
  // bucket since last tick); they fire `changeKinds.push('deps')` so
  // the agent knows a dep-bucket moved, but counting them would
  // conflate "PR newly adds foo" with "PR no longer removes foo",
  // which mean different things to the reviewer.
  const deps = {
    added: depAddsDiff.added,
    removed: depRemovesDiff.added,
    bumped: depBumpsDiff.added,
  };
  const depsChanged =
    depAddsDiff.added +
      depAddsDiff.removed +
      depRemovesDiff.added +
      depRemovesDiff.removed +
      depBumpsDiff.added +
      depBumpsDiff.removed >
    0;

  const changeKinds: WatchDelta['changeKinds'] = [];
  if (!prev || prev.verdict !== next.verdict) changeKinds.push('verdict');
  if (!prev || prev.baseSha !== next.baseSha) changeKinds.push('baseSha');
  if (!prev || prev.headSha !== next.headSha) changeKinds.push('headSha');
  if (!prev || prev.changedFilesCount !== next.changedFilesCount) changeKinds.push('changedFiles');
  if (cycles.added + cycles.removed > 0) changeKinds.push('cycles');
  if (risky.added + risky.removed > 0) changeKinds.push('risky');
  if (taint.added + taint.removed > 0) changeKinds.push('taint');
  if (depsChanged) changeKinds.push('deps');

  return { changeKinds, cycles, risky, taint, deps };
}

function setDiffCounts(prev: Set<string>, next: Set<string>): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const k of next) if (!prev.has(k)) added++;
  for (const k of prev) if (!next.has(k)) removed++;
  return { added, removed };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Test-only: drop all watches in the module. Lets unit tests verify
 * start/stop semantics without leaking timers across cases.
 */
export function __resetReviewWatchesForTests(): void {
  watches.clear();
}

/**
 * Test-only exports: snapshot + diff helpers for the 1.9 signature
 * deepening. Keeping these accessible avoids over-loading the public
 * tool surface with internals while still letting tests assert on the
 * specific shape and per-bucket counts the agent will see.
 */
export const __internal = {
  snapshotOf,
  signatureOf,
  diffSnapshots,
};
export type { WatchSnapshot, WatchDelta };
