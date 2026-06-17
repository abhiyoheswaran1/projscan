import { getToolDefinitions, getToolHandler } from './tools.js';
import { getPromptDefinitions, getPrompt } from './prompts.js';
import { getResourceDefinitions, readResource } from './resources.js';
import { applyToolBudgetAndCost, formatToolContent } from './serverPayload.js';
import {
  fail,
  JSONRPC_ERROR,
  ok,
  type JsonRpcId,
  type JsonRpcResponse,
  type McpDispatchHandlers,
} from './serverDispatch.js';
import { withProgress } from './progress.js';
import { buildProgressEmitter, createToolContext } from './serverContext.js';
import type { McpServerLifecycle } from './serverLifecycle.js';
import type { ServerSessionRecorder } from './serverSession.js';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'];
const PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

type NotifyTransport = (payload: string) => void;

export interface CreateMcpDispatchHandlersOptions {
  rootPath: string;
  serverVersion: string;
  watchEnabled: boolean;
  notify?: NotifyTransport;
  toolWatches: Map<string, () => void>;
  lifecycle: McpServerLifecycle;
  sessionRecorder: ServerSessionRecorder;
}

export function createMcpDispatchHandlers(
  options: CreateMcpDispatchHandlersOptions,
): McpDispatchHandlers {
  return {
    initialize: (id, params) => handleInitialize(id, params, options),
    toolsList: (id) => ok(id, { tools: getToolDefinitions() }),
    toolsCall: (id, params) => handleToolsCall(id, params, options),
    promptsList: (id) => ok(id, { prompts: getPromptDefinitions() }),
    promptsGet: (id, params) => handlePromptsGet(id, params, options.rootPath),
    resourcesList: (id) => ok(id, { resources: getResourceDefinitions() }),
    resourcesRead: (id, params) => handleResourcesRead(id, params, options.rootPath),
  };
}

async function handleInitialize(
  id: JsonRpcId,
  rawParams: unknown,
  options: CreateMcpDispatchHandlersOptions,
): Promise<JsonRpcResponse> {
  const params = (rawParams ?? {}) as { protocolVersion?: string };
  const requested = params.protocolVersion;
  const negotiated =
    requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSION;
  await options.lifecycle.ensureFileWatcherStarted();
  return ok(id, {
    protocolVersion: negotiated,
    serverInfo: { name: 'projscan', version: options.serverVersion },
    capabilities: {
      tools: { listChanged: false },
      prompts: { listChanged: false },
      resources: { listChanged: false, subscribe: false },
      logging: {},
      ...(options.watchEnabled
        ? { experimental: { fileChanged: { method: 'notifications/file_changed' } } }
        : {}),
    },
  });
}

async function handleToolsCall(
  id: JsonRpcId,
  rawParams: unknown,
  options: CreateMcpDispatchHandlersOptions,
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
    const ctx = createToolContext(options.notify, options.toolWatches);
    const result = await withProgress(emit, () => handler(args, options.rootPath, ctx));
    const { payload, estimatedTokens } = applyToolBudgetAndCost(result, args);
    // Record AFTER budgeting so the cost we log is the cost the
    // agent actually pays, not the pre-truncation payload size.
    await options.sessionRecorder.recordToolCall(name, result, estimatedTokens);
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
  id: JsonRpcId,
  rawParams: unknown,
  rootPath: string,
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
  id: JsonRpcId,
  rawParams: unknown,
  rootPath: string,
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
