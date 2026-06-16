import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getToolDefinitions, getToolHandler } from './tools.js';
import { getPromptDefinitions, getPrompt } from './prompts.js';
import { getResourceDefinitions, readResource } from './resources.js';
import { applyToolBudgetAndCost, formatToolContent } from './serverPayload.js';
import {
  dispatchMcpRequest,
  fail,
  JSONRPC_ERROR,
  ok,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpDispatchHandlers,
} from './serverDispatch.js';
import { withProgress, type ProgressEmitter } from './progress.js';
import { startWatcher, type WatchHandle } from '../core/watcher.js';
import {
  loadSession,
  recordTouch,
  recordEvent,
  saveSession,
  type Session,
} from '../core/session.js';
import { extractTouchedPaths } from './sessionTouchScanner.js';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'];
const PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

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
  let watchHandle: WatchHandle | null = null;
  let watchStartPromise: Promise<void> | null = null;
  const watchEnabled = options.watch === true && options.notify !== undefined;

  // 1.4 — durable cross-invocation session. Lazily loaded on first
  // tool call, persisted after every touch. Skipping pre-load on init
  // because the server might never receive a tool call (e.g., the
  // client only does tools/list and disconnects).
  // 1.8+ — registry for long-running tool-side watches (e.g.,
  // projscan_review_watch). Each entry is a cancel callback; the server
  // calls them on close() so polling timers don't leak.
  const toolWatches = new Map<string, () => void>();

  let session: Session | null = null;
  let sessionDirty = false;
  // 1.7+ — gate concurrent ensureSession() callers behind a single
  // in-flight load. Without this, two MCP requests arriving back-to-back
  // could each call loadSession(), each get their own deserialized object,
  // and each save back — last-write-wins would silently drop touches and
  // events from the earlier request.
  let sessionLoadPromise: Promise<Session> | null = null;

  async function ensureSession(): Promise<Session> {
    if (session) return session;
    if (sessionLoadPromise) return sessionLoadPromise;
    sessionLoadPromise = (async () => {
      const { session: loaded } = await loadSession(rootPath);
      session = loaded;
      sessionLoadPromise = null;
      return loaded;
    })();
    try {
      return await sessionLoadPromise;
    } catch (err) {
      sessionLoadPromise = null;
      throw err;
    }
  }

  async function persistSessionIfDirty(): Promise<void> {
    if (!session || !sessionDirty) return;
    await saveSession(rootPath, session);
    sessionDirty = false;
  }

  async function handleInitialize(
    id: string | number | null,
    rawParams: unknown,
  ): Promise<JsonRpcResponse> {
    const params = (rawParams ?? {}) as { protocolVersion?: string };
    const requested = params.protocolVersion;
    const negotiated =
      requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSION;
    if (watchEnabled && !watchStartPromise) {
      watchStartPromise = startFileWatcher();
    }
    if (watchStartPromise) {
      await watchStartPromise;
    }
    return ok(id, {
      protocolVersion: negotiated,
      serverInfo: { name: 'projscan', version: serverVersion },
      capabilities: {
        tools: { listChanged: false },
        prompts: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
        logging: {},
        ...(watchEnabled
          ? { experimental: { fileChanged: { method: 'notifications/file_changed' } } }
          : {}),
      },
    });
  }

  async function handleToolsCall(
    id: string | number | null,
    rawParams: unknown,
  ): Promise<JsonRpcResponse> {
    const params = (rawParams ?? {}) as {
      name?: string;
      arguments?: Record<string, unknown>;
      _meta?: { progressToken?: string | number };
    };
    const name = params.name;
    if (!name) return fail(id, JSONRPC_ERROR.InvalidParams, 'Missing tool name');
    const handler = getToolHandler(name);
    if (!handler) return fail(id, JSONRPC_ERROR.MethodNotFound, `Unknown tool: ${name}`);

    try {
      const args = params.arguments ?? {};
      const emit = buildProgressEmitter(params._meta?.progressToken);
      const ctx = buildToolContext();
      const result = await withProgress(emit, () => handler(args, rootPath, ctx));
      const { payload, estimatedTokens } = applyToolBudgetAndCost(result, args);
      // Record AFTER budgeting so the cost we log is the cost the
      // agent actually pays, not the pre-truncation payload size.
      await recordSessionTouches(name, result, estimatedTokens);
      const content = formatToolContent(payload, args.stream === true);
      return ok(id, { content, isError: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return ok(id, {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      });
    }
  }

  async function handlePromptsGet(
    id: string | number | null,
    rawParams: unknown,
  ): Promise<JsonRpcResponse> {
    const params = (rawParams ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    if (!params.name) return fail(id, JSONRPC_ERROR.InvalidParams, 'Missing prompt name');
    try {
      const result = await getPrompt(params.name, params.arguments ?? {}, rootPath);
      return ok(id, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(id, JSONRPC_ERROR.InvalidParams, message);
    }
  }

  async function handleResourcesRead(
    id: string | number | null,
    rawParams: unknown,
  ): Promise<JsonRpcResponse> {
    const params = (rawParams ?? {}) as { uri?: string };
    if (!params.uri) return fail(id, JSONRPC_ERROR.InvalidParams, 'Missing resource uri');
    try {
      const content = await readResource(params.uri, rootPath);
      return ok(id, { contents: [content] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(id, JSONRPC_ERROR.InvalidParams, message);
    }
  }

  const dispatchHandlers: McpDispatchHandlers = {
    initialize: handleInitialize,
    toolsList: (id) => ok(id, { tools: getToolDefinitions() }),
    toolsCall: handleToolsCall,
    promptsList: (id) => ok(id, { prompts: getPromptDefinitions() }),
    promptsGet: handlePromptsGet,
    resourcesList: (id) => ok(id, { resources: getResourceDefinitions() }),
    resourcesRead: handleResourcesRead,
  };

  /**
   * 1.8+ — build the per-call tool context. Tools that opt in (e.g.,
   * projscan_review_watch) use this to access the notify channel and
   * register polling watches with the server. Tools that don't opt in
   * ignore the third arg and continue to operate on (args, rootPath).
   *
   * Watches registered here are tracked in `toolWatches` and cancelled
   * on close() so timers can't leak past server shutdown.
   */
  function buildToolContext(): import('./tools/_shared.js').McpToolContext {
    return {
      notify: options.notify
        ? (method, params) => {
            try {
              const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
              options.notify!(payload);
              return true;
            } catch {
              return false;
            }
          }
        : undefined,
      registerWatch: (cancel) => {
        const id = `watch-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
        toolWatches.set(id, cancel);
        return id;
      },
      unregisterWatch: (watchId) => {
        const cancel = toolWatches.get(watchId);
        if (!cancel) return false;
        try {
          cancel();
        } catch {
          // best-effort
        }
        toolWatches.delete(watchId);
        return true;
      },
    };
  }

  /**
   * Build a progress emitter that forwards progress events to the
   * client over the notify channel — IFF the client supplied a
   * progressToken AND the transport gave us a notify channel.
   */
  function buildProgressEmitter(
    progressToken: string | number | undefined,
  ): ProgressEmitter | undefined {
    if (progressToken === undefined || !options.notify) return undefined;
    const notify = options.notify;
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

  /**
   * 1.4 — record session touches from any file paths the tool surfaced,
   * plus an event for the call itself. Skipped when the call IS for
   * `projscan_session` or the cost-summary tool itself (don't pollute
   * the read with the read).
   * Best-effort: failures here never break the tool call.
   *
   * 1.7+ — when `estimatedTokens` is provided, attaches it to the event
   * so `projscan_cost_summary` can aggregate per-tool costs. The session
   * event log is bounded (MAX_EVENTS = 500), so the cost view reflects
   * recent activity rather than the full lifetime of the session.
   */
  async function recordSessionTouches(
    name: string,
    result: unknown,
    estimatedTokens?: number,
  ): Promise<void> {
    if (name === 'projscan_session' || name === 'projscan_cost_summary') return;
    try {
      const sess = await ensureSession();
      const data: Record<string, unknown> = {};
      if (typeof estimatedTokens === 'number' && Number.isFinite(estimatedTokens)) {
        data.estimatedTokens = estimatedTokens;
      }
      recordEvent(sess, `tool-call:${name}`, Object.keys(data).length > 0 ? data : undefined);
      sessionDirty = true;
      const paths = extractTouchedPaths(result);
      for (const p of paths) recordTouch(sess, p, 'tool-result');
      await persistSessionIfDirty();
    } catch {
      // Session is best-effort.
    }
  }

  async function handleMessage(line: string): Promise<string | null> {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      return JSON.stringify(fail(null, JSONRPC_ERROR.ParseError, 'Invalid JSON'));
    }

    if (
      !request ||
      typeof request !== 'object' ||
      request.jsonrpc !== '2.0' ||
      typeof request.method !== 'string'
    ) {
      return JSON.stringify(
        fail(request?.id ?? null, JSONRPC_ERROR.InvalidRequest, 'Invalid JSON-RPC request'),
      );
    }

    const response = await dispatchMcpRequest(request, dispatchHandlers);
    if (!response) return null;
    return JSON.stringify(response);
  }

  async function startFileWatcher(): Promise<void> {
    if (!options.notify) return;
    const notify = options.notify;
    watchHandle = startWatcher(rootPath, {
      onChange: async ({ paths, graph }) => {
        // The watcher fires once on startup with `paths: []` (the initial
        // graph build). Skip it — clients only care about deltas.
        if (paths.length === 0) return;
        const payload = JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/file_changed',
          params: {
            paths,
            scannedFiles: graph.scannedFiles,
            timestampMs: Date.now(),
          },
        });
        notify(payload);

        // 1.4 — also record fs-watch touches in the session so an
        // agent's later `projscan_session touched` query reflects what
        // changed on disk during the session.
        try {
          const sess = await ensureSession();
          for (const p of paths) recordTouch(sess, p, 'fs-watch');
          recordEvent(sess, 'fs-watch:batch', { count: paths.length });
          sessionDirty = true;
          await persistSessionIfDirty();
        } catch {
          // Best-effort.
        }
      },
    });
    try {
      await watchHandle.ready;
    } catch {
      // Initial scan failure shouldn't take the server down; the agent can
      // still call tools, they just won't get push notifications.
    }
  }

  async function close(): Promise<void> {
    const handle = watchHandle;
    watchHandle = null;
    if (handle) {
      handle.close();
    }
    // 1.8+ — cancel any tool-side watches (review-watch polling, etc.)
    // so their timers don't outlive the server.
    for (const cancel of toolWatches.values()) {
      try {
        cancel();
      } catch {
        // best-effort
      }
    }
    toolWatches.clear();
    if (watchStartPromise) {
      await watchStartPromise.catch(() => undefined);
      watchStartPromise = null;
    }
    if (handle) {
      await handle.closed.catch(() => undefined);
    }
    await persistSessionIfDirty().catch(() => undefined);
  }

  return { handleMessage, close };
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
