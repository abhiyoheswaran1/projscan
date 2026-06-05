import { computeCoordination, coordinationSignature } from '../../core/coordination.js';
import type { McpTool, McpToolContext } from './_shared.js';

/**
 * `projscan_coordinate_watch` (4.x arc hardening) — long-running swarm
 * coordination watch. Polls the in-flight worktrees on an interval and emits a
 * `notifications/projscan/coordination_changed` notification whenever the
 * coordination state changes (readiness, collisions, contended claims, merge
 * hotspots). Pairs with `projscan_coordinate` (one-shot). Local-first.
 *
 * Modeled on projscan_review_watch and built entirely on the generic
 * McpToolContext (notify / registerWatch / unregisterWatch) — no server change.
 * Polling (not fs.watch) because the state spans every worktree, so changes by
 * other agents must be picked up.
 *
 * Actions: "start" (returns the initial summary + a watchId), "stop", "list".
 */

interface CoordinateWatchState {
  watchId: string;
  intervalMs: number;
  startedAt: string;
  ticks: number;
  lastSignature: string;
  inFlight: boolean;
  timer: ReturnType<typeof setInterval> | null;
}

const watches = new Map<string, CoordinateWatchState>();
const DEFAULT_INTERVAL_S = 15;
const MIN_INTERVAL_S = 5;
const MAX_INTERVAL_S = 600;

export const coordinateWatchTool: McpTool = {
  name: 'projscan_coordinate_watch',
  description:
    "Long-running swarm coordination watch across the repo's in-flight git worktrees. Polls on an interval and emits a `notifications/projscan/coordination_changed` notification whenever the coordination state changes — readiness (clear/caution/conflicted), collision counts, contended claims, or merge hotspots. Pairs with projscan_coordinate (one-shot): use this when an agent wants to react to other agents' changes without re-asking. Local-first. Actions: \"start\" (returns the initial summary + a watchId), \"stop\" (by watchId), \"list\".",
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'stop', 'list'],
        description: '"start" begins polling (returns initial summary + watchId). "stop" cancels by id. "list" enumerates active watches.',
      },
      base_ref: { type: 'string', description: 'Base ref each worktree is diffed against. (start only)' },
      interval_seconds: {
        type: 'number',
        description: `Poll interval in seconds. Default ${DEFAULT_INTERVAL_S}, min ${MIN_INTERVAL_S}, max ${MAX_INTERVAL_S}. (start only)`,
      },
      watchId: { type: 'string', description: 'Watch id from a previous "start". (stop only)' },
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function startWatch(
  args: Record<string, unknown>,
  rootPath: string,
  context: McpToolContext | undefined,
): Promise<unknown> {
  const baseRef = typeof args.base_ref === 'string' && args.base_ref ? args.base_ref : undefined;
  const detectOptions = baseRef ? { baseRef } : {};
  const requested =
    typeof args.interval_seconds === 'number' && Number.isFinite(args.interval_seconds)
      ? args.interval_seconds
      : DEFAULT_INTERVAL_S;
  const intervalSeconds = clamp(requested, MIN_INTERVAL_S, MAX_INTERVAL_S);
  const intervalMs = Math.round(intervalSeconds * 1000);

  const initial = await computeCoordination(rootPath, detectOptions);
  const initialSignature = coordinationSignature(initial);

  if (!context?.registerWatch || !context.notify) {
    return {
      action: 'start',
      watchId: null,
      registered: false,
      reason:
        'No notify channel — server was started without one (or this is a non-MCP caller). Initial summary attached; subscribe to the MCP notify channel for incremental updates.',
      intervalSeconds,
      report: initial,
    };
  }

  const watchId = context.registerWatch(() => {
    const state = watches.get(watchId);
    if (state?.timer) clearInterval(state.timer);
    watches.delete(watchId);
  });
  const state: CoordinateWatchState = {
    watchId,
    intervalMs,
    startedAt: new Date().toISOString(),
    ticks: 0,
    lastSignature: initialSignature,
    inFlight: false,
    timer: null,
  };
  state.timer = setInterval(() => void runTick(watchId, rootPath, detectOptions, context), intervalMs);
  watches.set(watchId, state);

  return { action: 'start', watchId, registered: true, intervalSeconds, report: initial };
}

async function runTick(
  watchId: string,
  rootPath: string,
  detectOptions: { baseRef?: string },
  context: McpToolContext,
): Promise<void> {
  const state = watches.get(watchId);
  // Drop overlapping ticks: one computeCoordination at a time per watch.
  if (!state || state.inFlight) return;
  state.inFlight = true;
  try {
    const report = await computeCoordination(rootPath, detectOptions);
    const signature = coordinationSignature(report);
    state.ticks += 1;
    if (signature !== state.lastSignature) {
      state.lastSignature = signature;
      context.notify?.('notifications/projscan/coordination_changed', { watchId, report });
    }
  } catch (err) {
    context.notify?.('notifications/projscan/coordination_error', {
      watchId,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    const current = watches.get(watchId);
    if (current) current.inFlight = false;
  }
}

function stopWatch(args: Record<string, unknown>, context: McpToolContext | undefined): unknown {
  const watchId = typeof args.watchId === 'string' ? args.watchId : '';
  if (!watchId) throw new Error('stop action requires a `watchId` from a previous "start".');
  // unregisterWatch runs the registered cancel (clears the timer + drops state).
  const stopped = context?.unregisterWatch ? context.unregisterWatch(watchId) : false;
  if (!stopped) {
    const state = watches.get(watchId);
    if (state?.timer) clearInterval(state.timer);
    watches.delete(watchId);
  }
  return { action: 'stop', watchId, stopped };
}

function listWatches(): unknown {
  return {
    action: 'list',
    watches: [...watches.values()].map((w) => ({
      watchId: w.watchId,
      startedAt: w.startedAt,
      intervalSeconds: w.intervalMs / 1000,
      ticks: w.ticks,
    })),
  };
}

/** Test-only: cancel all timers and drop watch state. */
export function __resetCoordinateWatchesForTests(): void {
  for (const state of watches.values()) {
    if (state.timer) clearInterval(state.timer);
  }
  watches.clear();
}
