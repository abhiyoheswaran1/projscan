import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Progress notification plumbing for long-running MCP tools.
 *
 * Per MCP spec, a client that wants progress sets `_meta.progressToken` on
 * the tool-call request. We capture it at dispatch time and expose a
 * `notify(progress, total?, message?)` callback to the tool handler via an
 * AsyncLocalStorage context - which means concurrent tool calls get their
 * own isolated emitters (the naive module-level-variable approach had tools
 * clobbering each other's progress streams under pipelined requests).
 *
 * Wire format (MCP 2024-11-05 + 2025-03-26):
 *   { "jsonrpc": "2.0", "method": "notifications/progress",
 *     "params": { "progressToken": <token>, "progress": <n>, "total"?: <n>, "message"?: "..." } }
 */

export type ProgressEmitter = (progress: number, total?: number, message?: string) => void;

const NOOP: ProgressEmitter = () => {};

// AsyncLocalStorage isolates the emitter per async context. Each tools/call
// dispatch starts a fresh context via `withProgress`, so concurrent tool
// calls never see each other's emitters.
const storage = new AsyncLocalStorage<ProgressEmitter>();

export function withProgress<T>(
  emit: ProgressEmitter | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!emit) return fn();
  return storage.run(emit, fn);
}

export function emitProgress(progress: number, total?: number, message?: string): void {
  const emit = storage.getStore();
  if (!emit) return;
  try {
    emit(progress, total, message);
  } catch {
    // progress is best-effort; never throw back into user code
  }
}

export { NOOP };
