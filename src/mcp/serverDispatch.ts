export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export const JSONRPC_ERROR = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

type DispatchResult = JsonRpcResponse | Promise<JsonRpcResponse>;
type DispatchHandler = (id: JsonRpcId, params: unknown) => DispatchResult;

export interface McpDispatchHandlers {
  initialize: DispatchHandler;
  toolsList: DispatchHandler;
  toolsCall: DispatchHandler;
  promptsList: DispatchHandler;
  promptsGet: DispatchHandler;
  resourcesList: DispatchHandler;
  resourcesRead: DispatchHandler;
}

interface DispatchContext {
  id: JsonRpcId;
  method: string;
  params: unknown;
  isNotification: boolean;
}

export async function dispatchMcpRequest(
  request: JsonRpcRequest,
  handlers: McpDispatchHandlers,
): Promise<JsonRpcResponse | null> {
  const context = dispatchContext(request);
  try {
    return await runDispatch(context, handlers);
  } catch (err) {
    return dispatchError(context, err);
  }
}

function dispatchContext(request: JsonRpcRequest): DispatchContext {
  return {
    id: request.id ?? null,
    method: request.method,
    params: request.params,
    isNotification: request.id === undefined || request.id === null,
  };
}

async function runDispatch(
  context: DispatchContext,
  handlers: McpDispatchHandlers,
): Promise<JsonRpcResponse | null> {
  if (isInitializedNotification(context.method)) return null;
  if (context.isNotification) return null;
  const handler = dispatchTable(handlers)[context.method];
  if (!handler) return methodNotFound(context);
  return await handler(context.id, context.params);
}

function methodNotFound(context: DispatchContext): JsonRpcResponse | null {
  if (context.isNotification) return null;
  return fail(context.id, JSONRPC_ERROR.MethodNotFound, `Method not found: ${context.method}`);
}

function dispatchError(context: DispatchContext, err: unknown): JsonRpcResponse | null {
  if (context.isNotification) return null;
  return fail(context.id, JSONRPC_ERROR.InternalError, errorMessage(err));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function dispatchTable(handlers: McpDispatchHandlers): Record<string, DispatchHandler> {
  return {
    initialize: handlers.initialize,
    ping: (id) => ok(id, {}),
    shutdown: (id) => ok(id, null),
    'tools/list': handlers.toolsList,
    'tools/call': handlers.toolsCall,
    'prompts/list': handlers.promptsList,
    'prompts/get': handlers.promptsGet,
    'resources/list': handlers.resourcesList,
    'resources/read': handlers.resourcesRead,
  };
}

function isInitializedNotification(method: string): boolean {
  return method === 'notifications/initialized' || method === 'initialized';
}

export function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function fail(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}
