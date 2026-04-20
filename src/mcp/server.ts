import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getToolDefinitions, getToolHandler } from './tools.js';
import { getPromptDefinitions, getPrompt } from './prompts.js';
import { getResourceDefinitions, readResource } from './resources.js';
import { applyBudget } from './tokenBudget.js';

const PROTOCOL_VERSION = '2024-11-05';

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
}

export function createMcpServer(rootPath: string): McpServerHandle {
  const serverVersion = readPackageVersion();
  let initialized = false;

  async function dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const id = request.id ?? null;

    // Notifications (no id) — no response expected.
    const isNotification = request.id === undefined || request.id === null;

    try {
      switch (request.method) {
        case 'initialize': {
          const params = (request.params ?? {}) as { protocolVersion?: string };
          initialized = true;
          return ok(id, {
            protocolVersion: params.protocolVersion ?? PROTOCOL_VERSION,
            serverInfo: {
              name: 'projscan',
              version: serverVersion,
            },
            capabilities: {
              tools: {},
              prompts: {},
              resources: {},
            },
          });
        }

        case 'notifications/initialized':
        case 'initialized':
          return null;

        case 'ping':
          return ok(id, {});

        case 'shutdown':
          return ok(id, null);

        case 'tools/list': {
          return ok(id, { tools: getToolDefinitions() });
        }

        case 'tools/call': {
          const params = (request.params ?? {}) as {
            name?: string;
            arguments?: Record<string, unknown>;
          };
          const name = params.name;
          if (!name) {
            return fail(id, JSONRPC_ERROR.InvalidParams, 'Missing tool name');
          }
          const handler = getToolHandler(name);
          if (!handler) {
            return fail(id, JSONRPC_ERROR.MethodNotFound, `Unknown tool: ${name}`);
          }
          try {
            const args = params.arguments ?? {};
            const result = await handler(args, rootPath);
            const rawMaxTokens = args.max_tokens;
            const maxTokens =
              typeof rawMaxTokens === 'number' && Number.isFinite(rawMaxTokens) && rawMaxTokens > 0
                ? rawMaxTokens
                : undefined;
            const budgeted = applyBudget(result, maxTokens !== undefined ? { maxTokens } : {});
            const payload = budgeted.truncated
              ? { ...(budgeted.value as object), _budget: { truncated: true, estimatedTokens: budgeted.estimatedTokens, maxTokens } }
              : budgeted.value;
            return ok(id, {
              content: [
                {
                  type: 'text',
                  text: safeStringify(payload),
                },
              ],
              isError: false,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return ok(id, {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true,
            });
          }
        }

        case 'prompts/list': {
          return ok(id, { prompts: getPromptDefinitions() });
        }

        case 'prompts/get': {
          const params = (request.params ?? {}) as {
            name?: string;
            arguments?: Record<string, unknown>;
          };
          if (!params.name) {
            return fail(id, JSONRPC_ERROR.InvalidParams, 'Missing prompt name');
          }
          try {
            const result = await getPrompt(params.name, params.arguments ?? {}, rootPath);
            return ok(id, result);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return fail(id, JSONRPC_ERROR.InvalidParams, message);
          }
        }

        case 'resources/list': {
          return ok(id, { resources: getResourceDefinitions() });
        }

        case 'resources/read': {
          const params = (request.params ?? {}) as { uri?: string };
          if (!params.uri) {
            return fail(id, JSONRPC_ERROR.InvalidParams, 'Missing resource uri');
          }
          try {
            const content = await readResource(params.uri, rootPath);
            return ok(id, { contents: [content] });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return fail(id, JSONRPC_ERROR.InvalidParams, message);
          }
        }

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

  return { handleMessage };
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

export async function runMcpServer(rootPath: string): Promise<void> {
  const server = createMcpServer(rootPath);

  process.stderr.write(`[projscan-mcp] listening on stdio (root=${rootPath})\n`);

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
}
