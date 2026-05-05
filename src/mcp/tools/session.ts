import type { McpTool } from './_shared.js';
import {
  loadSession,
  resetSession,
  saveSession,
  type Session,
  type SessionTouch,
} from '../../core/session.js';

/**
 * `projscan_session` (1.4+) — surface the current durable session so an
 * agent (or a coordinated swarm of agents) can ask "what's been touched
 * since I arrived?" without re-running git status / grep.
 *
 * Subactions:
 *   - "current" (default): session metadata (id, age, touched-file count, event count).
 *   - "touched": list of files touched in the current session. Sorted by
 *     last-touched descending. Filterable by source (`tool-result` /
 *     `fs-watch` / `explicit`) and supports cursor pagination.
 *   - "events": chronological event log. Bounded to the most recent 500.
 *   - "reset": discard the current session and start a fresh one. Useful
 *     when the agent is starting a new task and wants a clean slate.
 *
 * The session itself is populated by other paths in projscan (tool-call
 * dispatcher records auto-touches; `mcp --watch` records fs.watch events).
 * This tool is read-only except for the `reset` subaction.
 */
export const sessionTool: McpTool = {
  name: 'projscan_session',
  description:
    'Inspect the durable cross-invocation session: which files have been touched in this session, by what (tool result / fs watch / explicit), and the event log. Use to coordinate across multi-agent setups without re-querying git.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['current', 'touched', 'events', 'reset'],
        description:
          'Subaction. Default "current" returns session metadata. "touched" returns the touched-file list. "events" returns the event log. "reset" discards the current session and starts a fresh one.',
      },
      source: {
        type: 'string',
        enum: ['tool-result', 'fs-watch', 'explicit'],
        description:
          '"touched" only — restrict to files added by this source. Omit for all sources.',
      },
      cursor: {
        type: 'string',
        description: 'Opaque cursor for pagination (touched / events lists).',
      },
      page_size: {
        type: 'integer',
        description: 'Page size for paginated lists. Default 50, max 500.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const action = typeof args.action === 'string' ? args.action : 'current';
    const { session } = await loadSession(rootPath);

    switch (action) {
      case 'current':
        return summarizeSession(session);
      case 'touched':
        return touchedView(session, args);
      case 'events':
        return eventsView(session, args);
      case 'reset': {
        const fresh = await resetSession(rootPath);
        return {
          action: 'reset',
          previousSessionId: session.id,
          newSession: summarizeSession(fresh),
        };
      }
      default:
        throw new Error(
          `Unknown action "${action}". Valid actions: current, touched, events, reset.`,
        );
    }

    // Unreachable, but keeps the path that may add a `saveSession` later
    // explicit. The current handler reads only; nothing to persist.
    void saveSession;
  },
};

function summarizeSession(session: Session): Record<string, unknown> {
  const startedAtMs = Date.parse(session.startedAt);
  const lastActivityMs = Date.parse(session.lastActivityAt);
  const ageMs = Number.isFinite(lastActivityMs) ? Date.now() - startedAtMs : null;
  return {
    id: session.id,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    ageMs,
    touchedFileCount: Object.keys(session.touchedFiles).length,
    eventCount: session.events.length,
  };
}

function touchedView(session: Session, args: Record<string, unknown>): Record<string, unknown> {
  const sourceFilter = typeof args.source === 'string' ? args.source : undefined;
  const all = Object.values(session.touchedFiles);
  const filtered = sourceFilter ? all.filter((t) => t.source === sourceFilter) : all;
  // Sort by lastTouchedAt descending (most recently touched first).
  filtered.sort((a, b) => b.lastTouchedAt.localeCompare(a.lastTouchedAt));
  const { items, nextCursor } = paginate(filtered, args);
  return {
    sessionId: session.id,
    total: filtered.length,
    touched: items,
    ...(nextCursor ? { nextCursor } : {}),
  };
}

function eventsView(session: Session, args: Record<string, unknown>): Record<string, unknown> {
  // Newest-first for the consumer; the underlying log is append-order.
  const reversed = [...session.events].reverse();
  const { items, nextCursor } = paginate(reversed, args);
  return {
    sessionId: session.id,
    total: reversed.length,
    events: items,
    ...(nextCursor ? { nextCursor } : {}),
  };
}

interface PageResult<T> {
  items: T[];
  nextCursor?: string;
}

function paginate<T>(arr: T[], args: Record<string, unknown>): PageResult<T> {
  const pageSize = clampPageSize(args.page_size);
  const offset = decodeOffset(args.cursor);
  const slice = arr.slice(offset, offset + pageSize);
  const next = offset + pageSize;
  const nextCursor = next < arr.length ? encodeOffset(next) : undefined;
  return { items: slice, nextCursor };
}

function clampPageSize(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(500, Math.floor(raw)));
}

function encodeOffset(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf-8').toString('base64');
}

function decodeOffset(cursor: unknown): number {
  if (typeof cursor !== 'string' || cursor.length === 0) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    if (parsed && typeof parsed.offset === 'number' && Number.isFinite(parsed.offset)) {
      return Math.max(0, Math.floor(parsed.offset));
    }
  } catch {
    // Bad cursor — restart from offset 0.
  }
  return 0;
}

// Re-export for callers that want to inspect a touch entry shape.
export type { SessionTouch };
