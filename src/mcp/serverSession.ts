import {
  loadSession,
  recordEvent,
  recordTouch,
  saveSession,
  type Session,
} from '../core/session.js';
import { extractTouchedPaths } from './sessionTouchScanner.js';

export interface ServerSessionRecorder {
  recordToolCall(name: string, result: unknown, estimatedTokens?: number): Promise<void>;
  recordFileWatch(paths: string[]): Promise<void>;
  flush(): Promise<void>;
}

const SESSION_READ_TOOLS = new Set(['projscan_session', 'projscan_cost_summary']);

export function createServerSessionRecorder(rootPath: string): ServerSessionRecorder {
  let session: Session | null = null;
  let sessionDirty = false;
  let sessionLoadPromise: Promise<Session> | null = null;

  async function ensureSession(): Promise<Session> {
    if (session) return session;
    if (sessionLoadPromise) return sessionLoadPromise;
    sessionLoadPromise = loadFreshSession();
    try {
      return await sessionLoadPromise;
    } catch (err) {
      sessionLoadPromise = null;
      throw err;
    }
  }

  async function loadFreshSession(): Promise<Session> {
    const { session: loaded } = await loadSession(rootPath);
    session = loaded;
    sessionLoadPromise = null;
    return loaded;
  }

  async function persistSessionIfDirty(): Promise<void> {
    if (!session || !sessionDirty) return;
    await saveSession(rootPath, session);
    sessionDirty = false;
  }

  async function recordToolCall(
    name: string,
    result: unknown,
    estimatedTokens?: number,
  ): Promise<void> {
    if (SESSION_READ_TOOLS.has(name)) return;
    try {
      const sess = await ensureSession();
      const data = eventCostData(estimatedTokens);
      recordEvent(sess, `tool-call:${name}`, data);
      sessionDirty = true;
      for (const touchedPath of extractTouchedPaths(result)) {
        recordTouch(sess, touchedPath, 'tool-result');
      }
      await persistSessionIfDirty();
    } catch {
      // Session recording is best-effort.
    }
  }

  async function recordFileWatch(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    try {
      const sess = await ensureSession();
      for (const touchedPath of paths) recordTouch(sess, touchedPath, 'fs-watch');
      recordEvent(sess, 'fs-watch:batch', { count: paths.length });
      sessionDirty = true;
      await persistSessionIfDirty();
    } catch {
      // Session recording is best-effort.
    }
  }

  return {
    recordToolCall,
    recordFileWatch,
    flush: persistSessionIfDirty,
  };
}

function eventCostData(estimatedTokens: number | undefined): Record<string, unknown> | undefined {
  return typeof estimatedTokens === 'number' && Number.isFinite(estimatedTokens)
    ? { estimatedTokens }
    : undefined;
}
