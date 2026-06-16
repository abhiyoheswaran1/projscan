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
  type JsonRpcResponse,
  type McpDispatchHandlers,
} from './serverDispatch.js';
import { parseJsonRpcMessage } from './serverMessage.js';
import { withProgress } from './progress.js';
import { buildProgressEmitter, createToolContext } from './serverContext.js';
import { createMcpServerLifecycle } from './serverLifecycle.js';
import { createServerSessionRecorder } from './serverSession.js';

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

  async function handleInitialize(
    id: string | number | null,
    rawParams: unknown,
  ): Promise<JsonRpcResponse> {
    const params = (rawParams ?? {}) as { protocolVersion?: string };
    const requested = params.protocolVersion;
    const negotiated =
      requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSION;
    await lifecycle.ensureFileWatcherStarted();
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
      const emit = buildProgressEmitter(options.notify, params._meta?.progressToken);
      const ctx = createToolContext(options.notify, toolWatches);
      const result = await withProgress(emit, () => handler(args, rootPath, ctx));
      const { payload, estimatedTokens } = applyToolBudgetAndCost(result, args);
      // Record AFTER budgeting so the cost we log is the cost the
      // agent actually pays, not the pre-truncation payload size.
      await sessionRecorder.recordToolCall(name, result, estimatedTokens);
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
