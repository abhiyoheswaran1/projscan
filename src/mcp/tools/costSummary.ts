import { loadSession, type SessionEvent } from '../../core/session.js';
import type { McpTool } from './_shared.js';

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
    'Aggregate token-cost analytics from the current session\'s tool-call history. Returns total tokens spent, top spenders, per-tool typical/p95 estimates, and a static expected-cost catalog so the agent can budget pre-call. Pairs with the `_cost` sidecar attached to every tool result. Read-only. Note: the session event log is bounded at 500 entries, so the view reflects recent activity rather than the full lifetime of the session — for long-running sessions, older calls are dropped.',
  inputSchema: {
    type: 'object',
    properties: {
      top: {
        type: 'number',
        description: 'Optional. Number of top spenders to return. Default: 10.',
      },
    },
  },
  handler: async (args, rootPath) => {
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

    const perToolCatalog = ranked.map((b) => {
      const sorted = [...b.tokenSamples].sort((x, y) => x - y);
      const median = sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted.length === 0
        ? 0
        : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      return {
        tool: b.tool,
        observedTypicalTokens: median,
        observedP95Tokens: p95,
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
  },
};

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
  projscan_graph: 4500,
  projscan_structure: 3000,
  projscan_analyze: 3500,
  projscan_explain: 1500,
  projscan_explain_issue: 800,
  projscan_fix_suggest: 800,
  projscan_apply_fix: 1500,
  projscan_file: 2000,
  projscan_session: 500,
  projscan_memory: 1500,
  projscan_cost_summary: 1000,
};
