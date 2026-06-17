import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchMcpRequest } from './serverDispatch.js';
import { parseJsonRpcMessage } from './serverMessage.js';
import { createMcpServerLifecycle } from './serverLifecycle.js';
import { createServerSessionRecorder } from './serverSession.js';
import { createMcpDispatchHandlers } from './serverHandlers.js';

function readPackageVersion(): string {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));
    return String(pkg.version ?? '0.0.0');
  } catch {
    return '0.0.0';
  }
}

export interface McpServerHandle {
  handleMessage(line: string): Promise<string | null>;
  /** Stop any active watchers (1.3+). Idempotent. */
  close(): Promise<void>;
}

export interface McpServerOptions {
  /**
   * Called when the server wants to emit a JSON-RPC notification (e.g.,
   * `notifications/progress`, `notifications/file_changed`) out of band
   * from the normal request/response cycle. The transport layer is
   * responsible for writing the payload.
   */
  notify?: (payload: string) => void;
  /**
   * 1.3+ — when true, start a fs.watch on `rootPath` and emit
   * `notifications/file_changed` on each debounced batch. Off by default;
   * agents that don't ask for it pay nothing for it.
   */
  watch?: boolean;
}

export function createMcpServer(rootPath: string, options: McpServerOptions = {}): McpServerHandle {
  const serverVersion = readPackageVersion();
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

export interface RunMcpServerOptions {
  /** 1.3+ — emit notifications/file_changed on source-file changes. */
  watch?: boolean;
}

export async function runMcpServer(
  rootPath: string,
  runOptions: RunMcpServerOptions = {},
): Promise<void> {
  const server = createMcpServer(rootPath, {
    notify: (payload) => {
      process.stdout.write(payload + '\n');
    },
    watch: runOptions.watch,
  });

  const watchSuffix = runOptions.watch ? ' [watch on]' : '';
  process.stderr.write(`[projscan-mcp] listening on stdio (root=${rootPath})${watchSuffix}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    server
      .handleMessage(line)
      .then((response) => {
        if (response !== null) {
          process.stdout.write(response + '\n');
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[projscan-mcp] error: ${message}\n`);
      });
  });

  await new Promise<void>((resolve) => {
    rl.on('close', resolve);
    process.stdin.on('end', resolve);
  });

  await server.close();
}
