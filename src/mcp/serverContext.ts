import type { ProgressEmitter } from './progress.js';
import type { McpToolContext } from './tools/_shared.js';

type NotifyTransport = (payload: string) => void;

export function createToolContext(
  notify: NotifyTransport | undefined,
  toolWatches: Map<string, () => void>,
): McpToolContext {
  return {
    notify: notify ? buildToolNotifier(notify) : undefined,
    registerWatch: (cancel) => {
      const id = `watch-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      toolWatches.set(id, cancel);
      return id;
    },
    unregisterWatch: (watchId) => unregisterToolWatch(toolWatches, watchId),
  };
}

function buildToolNotifier(
  notify: NotifyTransport,
): NonNullable<McpToolContext['notify']> {
  return (method, params) => {
    try {
      const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
      notify(payload);
      return true;
    } catch {
      return false;
    }
  };
}

function unregisterToolWatch(toolWatches: Map<string, () => void>, watchId: string): boolean {
  const cancel = toolWatches.get(watchId);
  if (!cancel) return false;
  try {
    cancel();
  } catch {
    // best-effort
  }
  toolWatches.delete(watchId);
  return true;
}

export function buildProgressEmitter(
  notify: NotifyTransport | undefined,
  progressToken: string | number | undefined,
): ProgressEmitter | undefined {
  if (progressToken === undefined || !notify) return undefined;
  return (progress, total, message) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken,
        progress,
        ...(total !== undefined ? { total } : {}),
        ...(message !== undefined ? { message } : {}),
      },
    });
    notify(payload);
  };
}
