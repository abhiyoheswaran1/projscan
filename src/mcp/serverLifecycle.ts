import { startWatcher, type WatchHandle } from '../core/watcher.js';
import type { ServerSessionRecorder } from './serverSession.js';

interface McpServerLifecycleOptions {
  rootPath: string;
  notify?: (payload: string) => void;
  watchEnabled: boolean;
  toolWatches: Map<string, () => void>;
  sessionRecorder: ServerSessionRecorder;
}

export interface McpServerLifecycle {
  ensureFileWatcherStarted(): Promise<void>;
  close(): Promise<void>;
}

export function createMcpServerLifecycle(options: McpServerLifecycleOptions): McpServerLifecycle {
  let watchHandle: WatchHandle | null = null;
  let watchStartPromise: Promise<void> | null = null;

  async function ensureFileWatcherStarted(): Promise<void> {
    if (!options.watchEnabled) return;
    if (!watchStartPromise) watchStartPromise = startFileWatcher();
    await watchStartPromise;
  }

  async function startFileWatcher(): Promise<void> {
    if (!options.notify) return;
    const notify = options.notify;
    watchHandle = startWatcher(options.rootPath, {
      onChange: async ({ paths, graph }) => {
        // The watcher fires once on startup with `paths: []` (the initial
        // graph build). Skip it; clients only care about deltas.
        if (paths.length === 0) return;
        notify(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/file_changed',
            params: {
              paths,
              scannedFiles: graph.scannedFiles,
              timestampMs: Date.now(),
            },
          }),
        );
        await options.sessionRecorder.recordFileWatch(paths);
      },
    });
    try {
      await watchHandle.ready;
    } catch {
      // Initial scan failure should not take the server down.
    }
  }

  async function close(): Promise<void> {
    const handle = watchHandle;
    watchHandle = null;
    if (handle) handle.close();

    for (const cancel of options.toolWatches.values()) {
      try {
        cancel();
      } catch {
        // Best-effort: shutdown should continue after one bad cancel hook.
      }
    }
    options.toolWatches.clear();

    if (watchStartPromise) {
      await watchStartPromise.catch(() => undefined);
      watchStartPromise = null;
    }
    if (handle) await handle.closed.catch(() => undefined);
    await options.sessionRecorder.flush().catch(() => undefined);
  }

  return { ensureFileWatcherStarted, close };
}
