import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../../src/mcp/server.js';
import { getToolDefinitions } from '../../src/mcp/tools.js';

async function send(server: ReturnType<typeof createMcpServer>, message: unknown): Promise<unknown> {
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
    })) as { id: number; result: { serverInfo: { name: string }; capabilities: { tools: unknown } } };

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
    expect(names).toContain('projscan_explain');
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

  it('handles tools/call with unknown tool name', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'projscan_nope', arguments: {} },
    })) as { error: { code: number } };
    expect(response.error.code).toBe(-32601);
  });

  it('tools/call returns content with text JSON payload', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'projscan_structure', arguments: {} },
    })) as {
      result: {
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      };
    };

    expect(response.result.isError).toBe(false);
    expect(response.result.content[0].type).toBe('text');
    const payload = JSON.parse(response.result.content[0].text);
    expect(payload).toHaveProperty('structure');
    expect(payload).toHaveProperty('totalFiles');
  });

  it('projscan_explain rejects paths outside the root', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'projscan_explain',
        arguments: { file: '../../../etc/passwd' },
      },
    })) as {
      result: { content: Array<{ text: string }>; isError: boolean };
    };

    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toMatch(/inside the project root|ENOENT/);
  });

  it('all tool definitions have valid inputSchema', () => {
    for (const tool of getToolDefinitions()) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });
});
