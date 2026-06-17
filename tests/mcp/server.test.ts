import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../../src/mcp/server.js';
import { getToolDefinitions } from '../../src/mcp/tools.js';

async function send(
  server: ReturnType<typeof createMcpServer>,
  message: unknown,
): Promise<unknown> {
  const line = JSON.stringify(message);
  const raw = await server.handleMessage(line);
  return raw === null ? null : JSON.parse(raw);
}

describe('MCP server', () => {
  it('responds to initialize with protocol + server info', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    })) as {
      id: number;
      result: { serverInfo: { name: string }; capabilities: { tools: unknown } };
    };

    expect(response.id).toBe(1);
    expect(response.result.serverInfo.name).toBe('projscan');
    expect(response.result.capabilities.tools).toBeDefined();
  });

  it('ignores notifications (no response)', async () => {
    const server = createMcpServer(process.cwd());
    const response = await send(server, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(response).toBeNull();
  });

  it('ignores request notifications for known methods', async () => {
    const server = createMcpServer(process.cwd());

    await expect(
      send(server, {
        jsonrpc: '2.0',
        method: 'ping',
      }),
    ).resolves.toBeNull();
    await expect(
      send(server, {
        jsonrpc: '2.0',
        method: 'tools/list',
      }),
    ).resolves.toBeNull();
  });

  it('returns tool definitions on tools/list', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    })) as { result: { tools: Array<{ name: string }> } };

    const names = response.result.tools.map((t) => t.name);
    expect(names).toContain('projscan_doctor');
    expect(names).toContain('projscan_hotspots');
    expect(names).toContain('projscan_file');
    expect(names).toContain('projscan_coupling');
    expect(names.length).toBe(getToolDefinitions().length);
  });

  it('returns MethodNotFound for unknown method', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'does/not/exist',
    })) as { error: { code: number; message: string } };
    expect(response.error.code).toBe(-32601);
  });

  it('returns ParseError for invalid JSON', async () => {
    const server = createMcpServer(process.cwd());
    const raw = await server.handleMessage('{not json');
    expect(raw).not.toBeNull();
    const response = JSON.parse(raw as string) as { error: { code: number } };
    expect(response.error.code).toBe(-32700);
  });

  it('returns InvalidRequest when jsonrpc version is missing', async () => {
    const server = createMcpServer(process.cwd());
    const raw = await server.handleMessage(JSON.stringify({ id: 1, method: 'ping' }));
    expect(raw).not.toBeNull();
    const response = JSON.parse(raw as string) as { error: { code: number } };
    expect(response.error.code).toBe(-32600);
  });

  it('preserves message parser edge cases', async () => {
    const server = createMcpServer(process.cwd());

    await expect(server.handleMessage('   ')).resolves.toBeNull();

    const raw = await server.handleMessage(JSON.stringify({ id: 'bad-request', method: 'ping' }));
    expect(raw).not.toBeNull();
    const response = JSON.parse(raw as string) as { id: string; error: { code: number } };
    expect(response.id).toBe('bad-request');
    expect(response.error.code).toBe(-32600);
  });

  it('returns method-not-found for entirely unknown JSON-RPC method', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 103,
      method: 'totally/made/up',
    })) as { error?: { code: number; message: string } };
    expect(response.error?.code).toBe(-32601);
  });

});
