import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getToolDefinitions, getToolHandler } from './tools.js';
import { getPromptDefinitions, getPrompt } from './prompts.js';
import { getResourceDefinitions, readResource } from './resources.js';
import { applyBudget, attachCostSidecar, estimateTokens } from './tokenBudget.js';
import { withProgress, type ProgressEmitter } from './progress.js';
import { toContentBlocks } from './chunker.js';
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

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const JSONRPC_ERROR = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

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
  close(): void;
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
  let initialized = false;
  let watchHandle: WatchHandle | null = null;
  let watchStartPromise: Promise<void> | null = null;
  const watchEnabled = options.watch === true && options.notify !== undefined;

  // 1.4 — durable cross-invocation session. Lazily loaded on first
  // tool call, persisted after every touch. Skipping pre-load on init
  // because the server might never receive a tool call (e.g., the
  // client only does tools/list and disconnects).
  let session: Session | null = null;
  let sessionDirty = false;

  async function ensureSession(): Promise<Session> {
    if (session) return session;
    const { session: loaded } = await loadSession(rootPath);
    session = loaded;
    return session;
  }

  async function persistSessionIfDirty(): Promise<void> {
    if (!session || !sessionDirty) return;
    await saveSession(rootPath, session);
    sessionDirty = false;
  }

  async function dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const id = request.id ?? null;
    const isNotification = request.id === undefined || request.id === null;

    try {
      switch (request.method) {
        case 'initialize':
          return handleInitialize(id, request.params);
        case 'notifications/initialized':
        case 'initialized':
          return null;
        case 'ping':
          return ok(id, {});
        case 'shutdown':
          return ok(id, null);
        case 'tools/list':
          return ok(id, { tools: getToolDefinitions() });
        case 'tools/call':
          return await handleToolsCall(id, request.params);
        case 'prompts/list':
          return ok(id, { prompts: getPromptDefinitions() });
        case 'prompts/get':
          return await handlePromptsGet(id, request.params);
        case 'resources/list':
          return ok(id, { resources: getResourceDefinitions() });
        case 'resources/read':
          return await handleResourcesRead(id, request.params);
        default:
          if (isNotification) return null;
          return fail(id, JSONRPC_ERROR.MethodNotFound, `Method not found: ${request.method}`);
      }
    } catch (err) {
      if (isNotification) return null;
      const message = err instanceof Error ? err.message : String(err);
      return fail(id, JSONRPC_ERROR.InternalError, message);
    } finally {
      void initialized;
    }
  }

  function handleInitialize(id: string | number | null, rawParams: unknown): JsonRpcResponse {
    const params = (rawParams ?? {}) as { protocolVersion?: string };
    initialized = true;
    const requested = params.protocolVersion;
    const negotiated =
      requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSION;
    if (watchEnabled && !watchStartPromise) {
      watchStartPromise = startFileWatcher();
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
      const result = await withProgress(emit, () => handler(args, rootPath));
      await recordSessionTouches(name, result);
      const payload = applyBudgetAndCost(result, args);
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
   * `projscan_session` (don't pollute the read with the read).
   * Best-effort: failures here never break the tool call.
   */
  async function recordSessionTouches(name: string, result: unknown): Promise<void> {
    if (name === 'projscan_session') return;
    try {
      const sess = await ensureSession();
      recordEvent(sess, `tool-call:${name}`);
      sessionDirty = true;
      const paths = extractTouchedPaths(result);
      for (const p of paths) recordTouch(sess, p, 'tool-result');
      await persistSessionIfDirty();
    } catch {
      // Session is best-effort.
    }
  }

  /**
   * Apply the agent's `max_tokens` budget (post-hoc truncation) then
   * attach the `_cost` sidecar (1.5+) reflecting the final payload.
   * Budget and cost coexist when both fire; both are non-destructive.
   */
  function applyBudgetAndCost(result: unknown, args: Record<string, unknown>): unknown {
    const rawMaxTokens = args.max_tokens;
    const maxTokens =
      typeof rawMaxTokens === 'number' && Number.isFinite(rawMaxTokens) && rawMaxTokens > 0
        ? rawMaxTokens
        : undefined;
    const budgeted = applyBudget(result, maxTokens !== undefined ? { maxTokens } : {});
    const withBudget = budgeted.truncated
      ? attachBudgetSidecar(budgeted.value, {
          truncated: true,
          estimatedTokens: budgeted.estimatedTokens,
          maxTokens,
        })
      : budgeted.value;
    const finalEstimatedTokens = estimateTokens(JSON.stringify(withBudget) ?? '');
    return attachCostSidecar(withBudget, finalEstimatedTokens);
  }

  /**
   * Format the post-budget payload into MCP content blocks. With
   * `stream: true` the payload is split into multiple blocks (header
   * + N record blocks); the default is a single text block for
   * backwards compatibility.
   */
  function formatToolContent(payload: unknown, wantsStreaming: boolean): unknown[] {
    return wantsStreaming
      ? toContentBlocks(payload)
      : [{ type: 'text', text: safeStringify(payload) }];
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

    if (!request || typeof request !== 'object' || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      return JSON.stringify(fail(request?.id ?? null, JSONRPC_ERROR.InvalidRequest, 'Invalid JSON-RPC request'));
    }

    const response = await dispatch(request);
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

  function close(): void {
    if (watchHandle) {
      watchHandle.close();
      watchHandle = null;
    }
  }

  return { handleMessage, close };
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function fail(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface BudgetInfo {
  truncated: boolean;
  estimatedTokens: number;
  maxTokens?: number;
}

/**
 * Attach a _budget sidecar to the result. Arrays and primitives must be
 * wrapped rather than spread; object spread over an array yields a garbled
 * { "0": ..., "1": ..., _budget } object that breaks downstream consumers.
 */
function attachBudgetSidecar(value: unknown, info: BudgetInfo): unknown {
  if (Array.isArray(value)) {
    return { value, _budget: info };
  }
  if (value === null || typeof value !== 'object') {
    return { value, _budget: info };
  }
  return { ...(value as Record<string, unknown>), _budget: info };
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

  server.close();
}
