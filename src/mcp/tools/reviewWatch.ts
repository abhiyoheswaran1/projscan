import { computeReview } from '../../core/review.js';
import type { ReviewReport } from '../../types.js';
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

interface WatchState {
  watchId: string;
  base: string;
  head: string;
  intervalMs: number;
  startedAt: string;
  ticks: number;
  lastSignature: string | null;
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
    'Long-running PR review. Polls a base+head ref pair on an interval and emits a notifications/projscan/pr_changed notification whenever the review verdict, SHAs, flow count, or risky-function set changes. Pairs with projscan_review (one-shot) — use this when an agent wants to react to pushes on a PR without re-asking. Actions: start (returns initial review + watchId) / stop / list.',
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
  const initialSignature = signatureOf(initial);

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

    const sig = signatureOf(report);
    if (sig === state.lastSignature) return; // unchanged — silent
    state.lastSignature = sig;
    state.lastReportAt = new Date().toISOString();
    context.notify?.('notifications/projscan/pr_changed', {
      watchId,
      base: report.base?.ref ?? base ?? null,
      head: report.head?.ref ?? head ?? null,
      baseSha: report.base?.resolvedSha ?? null,
      headSha: report.head?.resolvedSha ?? null,
      report,
    });
  } finally {
    // Always clear the in-flight flag, even when the tick threw or
    // returned early — otherwise a single failure orphans the watch.
    state.inFlight = false;
  }
}

function stopWatch(
  args: Record<string, unknown>,
  context: McpToolContext | undefined,
): unknown {
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
 * A change-detection signature: tracks the bits of the review the
 * agent cares about (verdict, SHAs, flow / risky-fn counts and names).
 * Two ticks with identical signatures are silent; a delta on any of
 * these triggers a `pr_changed` notification with the full report.
 */
function signatureOf(report: ReviewReport): string {
  const parts: string[] = [];
  parts.push(report.verdict ?? '');
  parts.push(report.base?.resolvedSha ?? '');
  parts.push(report.head?.resolvedSha ?? '');
  parts.push(String(report.changedFiles?.length ?? 0));
  parts.push(String(report.newTaintFlows?.length ?? 0));
  const risky = (report.riskyFunctions ?? []).map((f) => f.name).sort().join(',');
  parts.push(risky);
  return parts.join('|');
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
