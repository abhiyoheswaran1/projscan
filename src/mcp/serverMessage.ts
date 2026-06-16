import {
  fail,
  JSONRPC_ERROR,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './serverDispatch.js';

export type ParsedJsonRpcMessage =
  | { kind: 'empty' }
  | { kind: 'error'; response: JsonRpcResponse }
  | { kind: 'request'; request: JsonRpcRequest };

export function parseJsonRpcMessage(line: string): ParsedJsonRpcMessage {
  const trimmed = line.trim();
  if (!trimmed) return { kind: 'empty' };

  const parsed = parseJson(trimmed);
  if (!parsed.ok) {
    return { kind: 'error', response: fail(null, JSONRPC_ERROR.ParseError, 'Invalid JSON') };
  }

  if (!isJsonRpcRequest(parsed.value)) {
    return {
      kind: 'error',
      response: fail(
        requestId(parsed.value),
        JSONRPC_ERROR.InvalidRequest,
        'Invalid JSON-RPC request',
      ),
    };
  }

  return { kind: 'request', request: parsed.value };
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { jsonrpc?: unknown }).jsonrpc === '2.0' &&
    typeof (value as { method?: unknown }).method === 'string'
  );
}

function requestId(value: unknown): JsonRpcId {
  if (!value || typeof value !== 'object' || !('id' in value)) return null;
  return ((value as { id?: unknown }).id ?? null) as JsonRpcId;
}
