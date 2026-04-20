/**
 * Progress notification plumbing for long-running MCP tools.
 *
 * Per MCP spec, a client that wants progress sets `_meta.progressToken` on
 * the tool-call request. We capture it at dispatch time and expose a
 * `notify(progress, total?)` callback to the tool handler via the rootPath
 * extension — which is awkward but keeps the handler signature unchanged
 * for tools that don't care.
 *
 * The notification wire format (MCP 2024-11-05 + 2025-03-26):
 *   { "jsonrpc": "2.0", "method": "notifications/progress",
 *     "params": { "progressToken": <token>, "progress": <n>, "total"?: <n>, "message"?: "..." } }
 */

export type ProgressEmitter = (progress: number, total?: number, message?: string) => void;

const NOOP: ProgressEmitter = () => {};

/**
 * AsyncLocalStorage-style context. We stash the current emitter on a
 * module-level WeakMap keyed by a symbol to survive `await` points.
 * Simpler than pulling in `node:async_hooks`.
 */
const emitters = new Map<symbol, ProgressEmitter>();

export function withProgress<T>(
  emit: ProgressEmitter | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!emit) return fn();
  const key = Symbol('progress');
  emitters.set(key, emit);
  currentKey = key;
  return fn().finally(() => {
    emitters.delete(key);
    currentKey = null;
  });
}

let currentKey: symbol | null = null;

export function emitProgress(progress: number, total?: number, message?: string): void {
  if (!currentKey) return;
  const emit = emitters.get(currentKey);
  if (!emit) return;
  try {
    emit(progress, total, message);
  } catch {
    // progress is best-effort; never throw back into user code
  }
}

export { NOOP };
