import { dispatchMcpRequest } from './serverDispatch.js';
import { parseJsonRpcMessage } from './serverMessage.js';
import { createMcpServerLifecycle } from './serverLifecycle.js';
import { createServerSessionRecorder } from './serverSession.js';
import { createMcpDispatchHandlers } from './serverHandlers.js';
import { runMcpServerStdio, type RunMcpServerOptions } from './serverStdio.js';
import type { McpServerHandle, McpServerOptions } from './serverTypes.js';
import { readMcpPackageVersion } from './serverVersion.js';

export type { RunMcpServerOptions } from './serverStdio.js';
export type { McpServerHandle, McpServerOptions } from './serverTypes.js';

export function createMcpServer(rootPath: string, options: McpServerOptions = {}): McpServerHandle {
  const serverVersion = readMcpPackageVersion();
  const watchEnabled = options.watch === true && options.notify !== undefined;

  // 1.4 — durable cross-invocation session. Lazily loaded on first
  // tool call, persisted after every touch. Skipping pre-load on init
  // because the server might never receive a tool call (e.g., the
  // client only does tools/list and disconnects).
  // 1.8+ — registry for long-running tool-side watches (e.g.,
  // projscan_review_watch). Each entry is a cancel callback; the server
  // calls them on close() so polling timers don't leak.
  const toolWatches = new Map<string, () => void>();
  const sessionRecorder = createServerSessionRecorder(rootPath);
  const lifecycle = createMcpServerLifecycle({
    rootPath,
    notify: options.notify,
    watchEnabled,
    toolWatches,
    sessionRecorder,
  });
  const dispatchHandlers = createMcpDispatchHandlers({
    rootPath,
    serverVersion,
    watchEnabled,
    notify: options.notify,
    toolWatches,
    lifecycle,
    sessionRecorder,
  });

  async function handleMessage(line: string): Promise<string | null> {
    const parsed = parseJsonRpcMessage(line);
    if (parsed.kind === 'empty') return null;
    if (parsed.kind === 'error') return JSON.stringify(parsed.response);

    const response = await dispatchMcpRequest(parsed.request, dispatchHandlers);
    if (!response) return null;
    return JSON.stringify(response);
  }

  return { handleMessage, close: lifecycle.close };
}

export async function runMcpServer(
  rootPath: string,
  runOptions: RunMcpServerOptions = {},
): Promise<void> {
  await runMcpServerStdio(rootPath, runOptions, createMcpServer);
}
