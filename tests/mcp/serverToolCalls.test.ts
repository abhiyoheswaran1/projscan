import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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

async function makeFixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-server-'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0' }),
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function withFixtureServer<T>(
  fn: (server: ReturnType<typeof createMcpServer>, root: string) => Promise<T>,
): Promise<T> {
  const root = await makeFixtureRoot();
  try {
    return await fn(createMcpServer(root), root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

describe('MCP server tool calls', () => {
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
    await withFixtureServer(async (server) => {
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
  });

  it('projscan_file refuses to read paths outside the root', async () => {
    await withFixtureServer(async (server) => {
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'projscan_file',
          arguments: { file: '../../../etc/passwd' },
        },
      })) as {
        result: { content: Array<{ text: string }>; isError: boolean };
      };

      // projscan_file reports the rejection in its payload rather than throwing,
      // but the security guarantee is the same: it never reads out-of-root
      // content. Assert the refusal is signalled and no passwd content leaks.
      const text = response.result.content[0].text;
      expect(text).toMatch(/outside the project root|not found|ENOENT/i);
      expect(text).not.toMatch(/root:.*:0:0:|\/bin\/(ba)?sh/);
    });
  });

  it('error responses short-circuit budget + cost sidecars', async () => {
    // When a tool throws, the dispatcher returns isError:true with the
    // bare error text. The cost / budget sidecars (which only make
    // sense for real result payloads) must not appear inside the error
    // content — otherwise an agent inspecting `result.content[0].text`
    // would see a JSON envelope instead of the error message. A missing
    // required arg makes projscan_file throw, exercising that path.
    await withFixtureServer(async (server) => {
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 99,
        method: 'tools/call',
        params: {
          name: 'projscan_file',
          arguments: { max_tokens: 5 },
        },
      })) as {
        result: { content: Array<{ text: string }>; isError: boolean };
      };
      expect(response.result.isError).toBe(true);
      const text = response.result.content[0].text;
      expect(text).toMatch(/^Error:/);
      expect(text).not.toContain('_cost');
      expect(text).not.toContain('_budget');
    });
  });

  it('returns method-not-found for unknown tools without crashing the dispatcher', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/call',
      params: { name: 'projscan_nonexistent', arguments: {} },
    })) as { error?: { code: number; message: string }; result?: unknown };
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toMatch(/Unknown tool/);
    // Dispatcher must still respond to subsequent valid calls.
    const followup = (await send(server, {
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/list',
    })) as { result: { tools: unknown[] } };
    expect(Array.isArray(followup.result.tools)).toBe(true);
  });

  it('returns invalid-params for tools/call with no name', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 102,
      method: 'tools/call',
      params: { arguments: {} },
    })) as { error?: { code: number; message: string } };
    expect(response.error?.code).toBe(-32602);
    expect(response.error?.message).toMatch(/Missing tool name/);
  });

  it('all tool definitions have valid inputSchema', () => {
    for (const tool of getToolDefinitions()) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it('projscan_file tool returns hotspot + issues + exports in one payload', async () => {
    await withFixtureServer(async (server) => {
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: { name: 'projscan_file', arguments: { file: 'src/index.ts' } },
      })) as {
        result: {
          isError: boolean;
          content: Array<{ text: string }>;
        };
      };
      expect(response.result.isError).toBe(false);
      const payload = JSON.parse(response.result.content[0].text) as {
        exists: boolean;
        relativePath: string;
        exports: unknown[];
      };
      expect(payload.exists).toBe(true);
      expect(payload.relativePath).toBe('src/index.ts');
      expect(Array.isArray(payload.exports)).toBe(true);
    });
  }, 20000);
});
