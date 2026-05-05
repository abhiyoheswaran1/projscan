import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Session — durable cross-invocation state for projscan (1.4+).
 *
 * Persisted at `.projscan-cache/session.json`. A new session starts when
 * the previous session has been idle for longer than `IDLE_TIMEOUT_MS`
 * (default 1 hour) or when none exists. Multiple agents calling the MCP
 * server against the same project share the same session as long as
 * they're within the idle window.
 *
 * Session purpose: let one agent answer "what has been touched since I
 * arrived?" without having to call git or grep. Touched files come from
 * (a) tool results that surface file paths, and (b) `notifications/file_changed`
 * push events from `projscan mcp --watch`.
 *
 * Schema is versioned (`schemaVersion`) so future evolution can detect
 * and migrate older session files instead of crashing.
 */

export const SESSION_SCHEMA_VERSION = 1;
export const DEFAULT_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export type TouchSource =
  | 'tool-result' // path appeared in a tool's response
  | 'fs-watch' // notifications/file_changed delivered the path
  | 'explicit'; // caller explicitly recorded it

export interface SessionTouch {
  /** Repo-relative path. Always POSIX-separator (`/`). */
  file: string;
  /** Where the touch came from. */
  source: TouchSource;
  /** ISO 8601 timestamp of the most recent touch. */
  lastTouchedAt: string;
  /** Total times this file has been touched in this session. */
  count: number;
}

export interface SessionEvent {
  /** ISO 8601 timestamp. */
  at: string;
  /** Free-form kind tag (e.g., "tool-call:projscan_hotspots"). */
  kind: string;
  /** Optional structured payload. */
  data?: Record<string, unknown>;
}

export interface Session {
  schemaVersion: number;
  /** UUID assigned at session creation. Stable until idle expiry. */
  id: string;
  /** ISO 8601. */
  startedAt: string;
  /** ISO 8601. Updated on every recordTouch / recordEvent / save. */
  lastActivityAt: string;
  /** Map keyed by repo-relative file path. */
  touchedFiles: Record<string, SessionTouch>;
  /** Bounded event log. Caps at MAX_EVENTS most-recent. */
  events: SessionEvent[];
}

const SESSION_DIR = '.projscan-cache';
const SESSION_FILENAME = 'session.json';
const MAX_EVENTS = 500;

/**
 * Load the session for `rootPath`. If the on-disk session has been idle
 * for longer than `idleTimeoutMs`, returns a fresh session. If no session
 * exists, returns a fresh session. Failures to read or parse the file
 * (corruption, schema mismatch) also produce a fresh session — this
 * function never throws under normal operation.
 *
 * Returns the session object PLUS a `created` flag so the caller can tell
 * whether they're attaching to an existing session or starting a new one.
 */
export async function loadSession(
  rootPath: string,
  idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
): Promise<{ session: Session; created: boolean }> {
  const filePath = sessionFilePath(rootPath);
  const now = new Date();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return { session: createFreshSession(now), created: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { session: createFreshSession(now), created: true };
  }

  if (!isSessionShape(parsed)) {
    return { session: createFreshSession(now), created: true };
  }

  // Schema-version gate: if a future writer bumps the version we don't
  // understand, treat it as a fresh session rather than corrupting their
  // newer data.
  if (parsed.schemaVersion !== SESSION_SCHEMA_VERSION) {
    return { session: createFreshSession(now), created: true };
  }

  const lastActivityMs = Date.parse(parsed.lastActivityAt);
  if (
    !Number.isFinite(lastActivityMs) ||
    now.getTime() - lastActivityMs > idleTimeoutMs
  ) {
    return { session: createFreshSession(now), created: true };
  }

  return { session: parsed, created: false };
}

/**
 * Record a file touch in-place on the session. Updates the per-file
 * count + lastTouchedAt and the session's lastActivityAt. Caller is
 * responsible for `saveSession()` afterwards (batched persist).
 *
 * `file` should be repo-relative POSIX-separator. Paths with `..` or
 * absolute paths are silently ignored — sessions only track in-repo state.
 */
export function recordTouch(session: Session, file: string, source: TouchSource): void {
  const normalized = normalizeFile(file);
  if (!normalized) return;
  const nowIso = new Date().toISOString();
  const existing = session.touchedFiles[normalized];
  if (existing) {
    existing.count += 1;
    existing.lastTouchedAt = nowIso;
    // First-seen source wins; promotes 'fs-watch' over a later 'tool-result'
    // if the watcher saw the file first. This is mostly informational.
  } else {
    session.touchedFiles[normalized] = {
      file: normalized,
      source,
      lastTouchedAt: nowIso,
      count: 1,
    };
  }
  session.lastActivityAt = nowIso;
}

/**
 * Append an event to the session's bounded log. The log keeps the last
 * MAX_EVENTS entries and drops the oldest when over capacity.
 */
export function recordEvent(session: Session, kind: string, data?: Record<string, unknown>): void {
  const event: SessionEvent = {
    at: new Date().toISOString(),
    kind,
    ...(data ? { data } : {}),
  };
  session.events.push(event);
  if (session.events.length > MAX_EVENTS) {
    session.events = session.events.slice(-MAX_EVENTS);
  }
  session.lastActivityAt = event.at;
}

/**
 * Persist the session to disk. Best-effort; failures are swallowed so
 * a transient write error doesn't break the calling tool.
 *
 * Last-write-wins semantics for now. If two MCP servers run against the
 * same repo concurrently, the later writer overwrites the earlier; this
 * is acceptable for the v1 scope (the multi-process case is rare and the
 * downside is just a slightly stale touched-file count, not corruption).
 */
export async function saveSession(rootPath: string, session: Session): Promise<void> {
  try {
    const dir = path.join(rootPath, SESSION_DIR);
    await fs.mkdir(dir, { recursive: true });
    const filePath = sessionFilePath(rootPath);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  } catch {
    // Swallow — sessions are best-effort.
  }
}

/**
 * Reset the session: discard the on-disk file and return a fresh one.
 * Useful for the `projscan_session { action: "reset" }` MCP path.
 */
export async function resetSession(rootPath: string): Promise<Session> {
  const filePath = sessionFilePath(rootPath);
  try {
    await fs.unlink(filePath);
  } catch {
    // Already absent; nothing to do.
  }
  const fresh = createFreshSession(new Date());
  await saveSession(rootPath, fresh);
  return fresh;
}

function createFreshSession(now: Date): Session {
  const iso = now.toISOString();
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: randomUUID(),
    startedAt: iso,
    lastActivityAt: iso,
    touchedFiles: {},
    events: [],
  };
}

function sessionFilePath(rootPath: string): string {
  return path.join(rootPath, SESSION_DIR, SESSION_FILENAME);
}

function normalizeFile(file: string): string | null {
  if (typeof file !== 'string' || file.length === 0) return null;
  if (file.includes('..')) return null;
  if (path.isAbsolute(file)) return null;
  // Convert any backslashes (Windows paths) to forward slashes for
  // cross-platform consistency in the session file.
  return file.split(path.sep).join('/').split('\\').join('/');
}

function isSessionShape(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.schemaVersion === 'number' &&
    typeof v.id === 'string' &&
    typeof v.startedAt === 'string' &&
    typeof v.lastActivityAt === 'string' &&
    typeof v.touchedFiles === 'object' &&
    Array.isArray(v.events)
  );
}
