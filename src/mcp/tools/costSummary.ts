import { loadSession, type SessionEvent } from '../../core/session.js';
import type { McpTool, McpToolContext } from './_shared.js';

const DEFAULT_STREAM_INTERVAL_S = 10;
const MIN_STREAM_INTERVAL_S = 2;
const MAX_STREAM_INTERVAL_S = 600;

/**
 * 1.7+ — `projscan_cost_summary`. Aggregate token-cost analytics
 * derived from the session event log. Builds on the `_cost` sidecar
 * (1.5+) and per-event recording (1.7+) to give the agent a single
 * dashboard view of where its context budget is going.
 *
 * Response shape:
 *   sessionId          : string         — current session id (or null when empty)
 *   totalCalls         : number         — tool-call events with a recorded cost
 *   totalEstimatedTokens : number       — sum of all recorded estimatedTokens
 *   averageTokens      : number         — mean across all recorded calls
 *   topSpenders        : [{ tool, totalTokens, callCount, averageTokens }]
 *                                       — ranked by totalTokens desc, top 10
 *   perToolCatalog     : [{ tool, observedTypicalTokens, observedP95Tokens,
 *                            callCount, expectedTokens }]
 *                                       — for every distinct tool that fired,
 *                                         observed statistics + a static
 *                                         "expected" baseline (see
 *                                         STATIC_EXPECTED_TOKENS) for
 *                                         pre-call budgeting.
 *
 * Read-only. Does not record an event for itself (avoids the
 * read-of-the-read pollution).
 */
export const costSummaryTool: McpTool = {
  name: 'projscan_cost_summary',
  description:
    'Aggregate token-cost analytics from the current session\'s tool-call history. action:"snapshot" (default) returns total tokens spent, top spenders, per-tool typical/p95 estimates, and a static expected-cost catalog so the agent can budget pre-call. 1.10+: action:"start_stream" / "stop_stream" / "list_streams" turns this into a live cost dashboard — the server polls the session log on an interval and emits notifications/projscan/cost_delta whenever new tool calls have accrued, with the per-tool deltas and the new cumulative totals inline. Pairs with the `_cost` sidecar attached to every tool result. Read-only. Note: the session event log is bounded at 500 entries — for long-running sessions, older calls are dropped from the snapshot.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['snapshot', 'start_stream', 'stop_stream', 'list_streams'],
        description:
          '"snapshot" (default) returns the current aggregate. "start_stream" begins a live cost-delta watch. "stop_stream" cancels by stream_id. "list_streams" enumerates active streams.',
      },
      top: {
        type: 'number',
        description:
          'Optional. Number of top spenders to return. Default: 10. (snapshot + start_stream)',
      },
      interval_seconds: {
        type: 'number',
        description: `Stream poll interval in seconds. Default: ${DEFAULT_STREAM_INTERVAL_S}. Min: ${MIN_STREAM_INTERVAL_S}, max: ${MAX_STREAM_INTERVAL_S}. (start_stream only)`,
      },
      stream_id: {
        type: 'string',
        description: 'Stream identifier returned by a previous start_stream. (stop_stream only)',
      },
    },
  },
  handler: async (args, rootPath, context) => {
    const action = typeof args.action === 'string' ? args.action : 'snapshot';
    switch (action) {
      case 'snapshot':
        return computeSnapshot(rootPath, args);
      case 'start_stream':
        return startStream(rootPath, args, context);
      case 'stop_stream':
        return stopStream(args, context);
      case 'list_streams':
        return listStreams();
      default:
        throw new Error(
          `Unknown action "${action}". Known: snapshot, start_stream, stop_stream, list_streams.`,
        );
    }
  },
};

interface CostStreamState {
  streamId: string;
  intervalMs: number;
  startedAt: string;
  ticks: number;
  /** Last-seen call count per tool. New events are the difference. */
  lastSeenCalls: Record<string, number>;
  /** Last cumulative totals so the delta payload is self-describing. */
  lastTotalTokens: number;
  lastTotalCalls: number;
  inFlight: boolean;
}

const streams = new Map<string, CostStreamState>();

async function computeSnapshot(rootPath: string, args: Record<string, unknown>): Promise<unknown> {
  const top =
    typeof args.top === 'number' && Number.isFinite(args.top) && args.top > 0
      ? Math.min(50, Math.floor(args.top))
      : 10;
  const { session } = await loadSession(rootPath);
  const buckets = bucketize(session.events);

  let totalCalls = 0;
  let totalEstimatedTokens = 0;
  for (const bucket of buckets.values()) {
    totalCalls += bucket.callCount;
    totalEstimatedTokens += bucket.totalTokens;
  }

  const ranked = [...buckets.values()].sort((a, b) => b.totalTokens - a.totalTokens);
  const topSpenders = ranked.slice(0, top).map((b) => ({
    tool: b.tool,
    totalTokens: b.totalTokens,
    callCount: b.callCount,
    averageTokens: b.callCount > 0 ? Math.round(b.totalTokens / b.callCount) : 0,
  }));

  // 1.8+ — only report a real p95 when we have enough samples for it
  // to be meaningful. With < MIN_P95_SAMPLES, sorted[len*0.95] just
  // returns the observed maximum, which agents misinterpret as a
  // representative high-water mark for budgeting. We surface null and
  // an explicit `insufficientSamples: true` flag so the agent knows
  // to fall back to expectedTokens or wait for more data.
  const MIN_P95_SAMPLES = 20;
  const perToolCatalog = ranked.map((b) => {
    const sorted = [...b.tokenSamples].sort((x, y) => x - y);
    const median = sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
    const hasEnoughForP95 = sorted.length >= MIN_P95_SAMPLES;
    const p95 = hasEnoughForP95
      ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
      : null;
    return {
      tool: b.tool,
      observedTypicalTokens: median,
      observedP95Tokens: p95,
      observedP95InsufficientSamples: !hasEnoughForP95,
      callCount: b.callCount,
      expectedTokens: STATIC_EXPECTED_TOKENS[b.tool] ?? null,
    };
  });

  return {
    sessionId: session.id,
    totalCalls,
    totalEstimatedTokens,
    averageTokens: totalCalls > 0 ? Math.round(totalEstimatedTokens / totalCalls) : 0,
    topSpenders,
    perToolCatalog,
  };
}

async function startStream(
  rootPath: string,
  args: Record<string, unknown>,
  context: McpToolContext | undefined,
): Promise<unknown> {
  const requested =
    typeof args.interval_seconds === 'number' && Number.isFinite(args.interval_seconds)
      ? args.interval_seconds
      : DEFAULT_STREAM_INTERVAL_S;
  const intervalSeconds = clamp(requested, MIN_STREAM_INTERVAL_S, MAX_STREAM_INTERVAL_S);
  const intervalMs = Math.round(intervalSeconds * 1000);

  // Seed last-seen counts so the first tick after start reports only NEW
  // calls — the initial snapshot is the baseline. Without this, every
  // existing event in the session log would be reported as a delta.
  const { session } = await loadSession(rootPath);
  const initialBuckets = bucketize(session.events);
  const lastSeenCalls: Record<string, number> = {};
  let lastTotalCalls = 0;
  let lastTotalTokens = 0;
  for (const b of initialBuckets.values()) {
    lastSeenCalls[b.tool] = b.callCount;
    lastTotalCalls += b.callCount;
    lastTotalTokens += b.totalTokens;
  }

  if (!context?.registerWatch || !context.notify) {
    return {
      action: 'start_stream',
      streamId: null,
      registered: false,
      reason:
        'No notify channel — server was started without one (or this is a non-MCP caller). Subscribe to the MCP notify channel to receive cost_delta updates.',
      intervalSeconds,
      baseline: { totalCalls: lastTotalCalls, totalEstimatedTokens: lastTotalTokens },
    };
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  const streamId = context.registerWatch(() => {
    if (timer) clearInterval(timer);
    timer = null;
    streams.delete(streamId);
  });

  streams.set(streamId, {
    streamId,
    intervalMs,
    startedAt: new Date().toISOString(),
    ticks: 0,
    lastSeenCalls,
    lastTotalTokens,
    lastTotalCalls,
    inFlight: false,
  });

  const tick = (): void => {
    void runCostTick(rootPath, streamId, context);
  };
  timer = setInterval(tick, intervalMs);
  // Don't keep the process alive on the polling timer alone.
  if (typeof timer.unref === 'function') timer.unref();

  return {
    action: 'start_stream',
    streamId,
    registered: true,
    intervalSeconds,
    baseline: { totalCalls: lastTotalCalls, totalEstimatedTokens: lastTotalTokens },
  };
}

async function runCostTick(
  rootPath: string,
  streamId: string,
  context: McpToolContext,
): Promise<void> {
  const state = streams.get(streamId);
  if (!state) return;
  // Single-flight guard. Session reads are fast but disk hiccups (slow
  // NFS, contended writes) could overlap; we don't queue, the next tick
  // picks up the latest state.
  if (state.inFlight) return;
  state.inFlight = true;
  state.ticks += 1;

  try {
    let session;
    try {
      const loaded = await loadSession(rootPath);
      session = loaded.session;
    } catch (err) {
      context.notify?.('notifications/projscan/cost_stream_error', {
        streamId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const buckets = bucketize(session.events);
    const perToolDelta: Array<{
      tool: string;
      callsAdded: number;
      tokensAdded: number;
      cumulativeCalls: number;
      cumulativeTokens: number;
    }> = [];
    let newTotalCalls = 0;
    let newTotalTokens = 0;
    const seen = new Set<string>();
    for (const b of buckets.values()) {
      seen.add(b.tool);
      newTotalCalls += b.callCount;
      newTotalTokens += b.totalTokens;
      const prevCalls = state.lastSeenCalls[b.tool] ?? 0;
      const callsAdded = b.callCount - prevCalls;
      if (callsAdded > 0) {
        // The session log is bounded to 500 entries — a per-tool count can
        // also DECREASE when old events for that tool roll off. We only
        // surface positive deltas (new calls); a decrease just adjusts
        // the running baseline without firing a delta event.
        const tokensAdded = b.totalTokens - (prevToolTokens(state, b, prevCalls) ?? 0);
        perToolDelta.push({
          tool: b.tool,
          callsAdded,
          tokensAdded: Math.max(0, tokensAdded),
          cumulativeCalls: b.callCount,
          cumulativeTokens: b.totalTokens,
        });
      }
      state.lastSeenCalls[b.tool] = b.callCount;
    }
    // Drop tools that have fully aged out of the log so the state map
    // doesn't grow forever.
    for (const tool of Object.keys(state.lastSeenCalls)) {
      if (!seen.has(tool)) delete state.lastSeenCalls[tool];
    }

    if (perToolDelta.length === 0) return; // nothing new — silent tick

    state.lastTotalCalls = newTotalCalls;
    state.lastTotalTokens = newTotalTokens;

    context.notify?.('notifications/projscan/cost_delta', {
      streamId,
      sessionId: session.id,
      perTool: perToolDelta,
      cumulative: {
        totalCalls: newTotalCalls,
        totalEstimatedTokens: newTotalTokens,
      },
    });
  } finally {
    state.inFlight = false;
  }
}

/**
 * The session event log is bounded; we don't carry per-tool token history
 * across ticks beyond a single call count. Approximating tokens-added by
 * (current total - prior average × prior count) is fragile, so we just
 * round up using the bucket's own token-per-call ratio. Good enough for
 * an at-a-glance dashboard; downstream agents that need exact attribution
 * can call action:"snapshot" for the canonical view.
 */
function prevToolTokens(state: CostStreamState, bucket: ToolBucket, prevCalls: number): number {
  if (bucket.callCount === 0 || prevCalls === 0) return 0;
  return Math.round((bucket.totalTokens / bucket.callCount) * prevCalls);
}

function stopStream(args: Record<string, unknown>, context: McpToolContext | undefined): unknown {
  const streamId = typeof args.stream_id === 'string' ? args.stream_id : '';
  if (!streamId) throw new Error('stop_stream action requires a "stream_id" argument');
  const knownLocally = streams.has(streamId);
  // The server's registerWatch cancel callback already deletes from `streams`.
  const cancelled = context?.unregisterWatch?.(streamId) ?? false;
  // If the server didn't know about the watch (e.g., cross-transport),
  // make sure our local map is also clean.
  if (streams.has(streamId)) streams.delete(streamId);
  return { action: 'stop_stream', streamId, cancelled: cancelled || knownLocally };
}

function listStreams(): unknown {
  return {
    action: 'list_streams',
    streams: [...streams.values()].map((s) => ({
      streamId: s.streamId,
      startedAt: s.startedAt,
      intervalMs: s.intervalMs,
      ticks: s.ticks,
      lastTotalCalls: s.lastTotalCalls,
      lastTotalTokens: s.lastTotalTokens,
    })),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface ToolBucket {
  tool: string;
  callCount: number;
  totalTokens: number;
  tokenSamples: number[];
}

function bucketize(events: ReadonlyArray<SessionEvent>): Map<string, ToolBucket> {
  const buckets = new Map<string, ToolBucket>();
  for (const ev of events) {
    if (!ev.kind.startsWith('tool-call:')) continue;
    const tokens = readEstimatedTokens(ev);
    if (tokens === null) continue; // Older sessions: pre-1.7 events without tokens.
    const tool = ev.kind.slice('tool-call:'.length);
    let bucket = buckets.get(tool);
    if (!bucket) {
      bucket = { tool, callCount: 0, totalTokens: 0, tokenSamples: [] };
      buckets.set(tool, bucket);
    }
    bucket.callCount += 1;
    bucket.totalTokens += tokens;
    bucket.tokenSamples.push(tokens);
  }
  return buckets;
}

function readEstimatedTokens(ev: SessionEvent): number | null {
  const data = ev.data as { estimatedTokens?: unknown } | undefined;
  if (!data) return null;
  const v = data.estimatedTokens;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Static "expected" cost catalog — rough order-of-magnitude tokens for
 * each tool's full (un-budgeted) response, derived from observed
 * default-shape outputs against a mid-sized repo (~1k files). These
 * are not promises; they're guidance for an agent picking a
 * `max_cost_tokens` budget pre-call. Adjust occasionally as tools evolve.
 */
const STATIC_EXPECTED_TOKENS: Record<string, number> = {
  projscan_doctor: 4500,
  projscan_review: 6500,
  projscan_pr_diff: 3500,
  projscan_taint: 4000,
  projscan_impact: 3000,
  projscan_workspace_graph: 5500,
  projscan_workspaces: 1200,
  projscan_hotspots: 2200,
  projscan_coupling: 2500,
  projscan_coverage: 3000,
  projscan_dependencies: 2500,
  projscan_outdated: 1800,
  projscan_audit: 1500,
  projscan_upgrade: 1000,
  projscan_search: 2500,
  projscan_semantic_graph: 6000,
  projscan_dataflow: 3500,
  projscan_structure: 3000,
  projscan_analyze: 3500,
  projscan_explain_issue: 800,
  projscan_fix_suggest: 800,
  projscan_apply_fix: 1500,
  projscan_file: 2000,
  projscan_session: 500,
  projscan_memory: 1500,
  projscan_cost_summary: 1000,
};
