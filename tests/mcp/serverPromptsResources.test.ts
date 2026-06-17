import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMcpServer } from '../../src/mcp/server.js';

async function send(
  server: ReturnType<typeof createMcpServer>,
  message: unknown,
): Promise<unknown> {
  const line = JSON.stringify(message);
  const raw = await server.handleMessage(line);
  return raw === null ? null : JSON.parse(raw);
}

async function makeFixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-server-prompts-'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0' }),
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

describe('MCP server prompts and resources', () => {
  it('initialize advertises tools, prompts, and resources capabilities', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 99,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    })) as {
      result: {
        capabilities: { tools?: unknown; prompts?: unknown; resources?: unknown };
      };
    };
    expect(response.result.capabilities.tools).toBeDefined();
    expect(response.result.capabilities.prompts).toBeDefined();
    expect(response.result.capabilities.resources).toBeDefined();
  });

  it('prompts/list returns the prompts', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 10,
      method: 'prompts/list',
    })) as { result: { prompts: Array<{ name: string }> } };
    const names = response.result.prompts.map((p) => p.name);
    expect(names).toContain('prioritize_refactoring');
    expect(names).toContain('investigate_file');
  });

  it('prompts/get prioritize_refactoring returns a user message', async () => {
    const root = await makeFixtureRoot();
    try {
      const server = createMcpServer(root);
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 11,
        method: 'prompts/get',
        params: { name: 'prioritize_refactoring', arguments: { limit: 3 } },
      })) as { result: { messages: Array<{ role: string; content: { text: string } }> } };
      expect(response.result.messages[0].role).toBe('user');
      expect(response.result.messages[0].content.text.length).toBeGreaterThan(100);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('prompts/get investigate_file requires a file arg', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 12,
      method: 'prompts/get',
      params: { name: 'investigate_file', arguments: {} },
    })) as { error: { code: number; message: string } };
    expect(response.error).toBeDefined();
    expect(response.error.message).toMatch(/file/i);
  });

  it('resources/list returns the canonical resources', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 13,
      method: 'resources/list',
    })) as { result: { resources: Array<{ uri: string }> } };
    const uris = response.result.resources.map((r) => r.uri);
    expect(uris).toContain('projscan://health');
    expect(uris).toContain('projscan://hotspots');
    expect(uris).toContain('projscan://structure');
  });

  it('resources/read returns JSON content', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 14,
      method: 'resources/read',
      params: { uri: 'projscan://structure' },
    })) as {
      result: {
        contents: Array<{ uri: string; mimeType: string; text: string }>;
      };
    };
    expect(response.result.contents[0].uri).toBe('projscan://structure');
    expect(response.result.contents[0].mimeType).toBe('application/json');
    expect(() => JSON.parse(response.result.contents[0].text)).not.toThrow();
  });

  it('resources/read rejects unknown URIs', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 15,
      method: 'resources/read',
      params: { uri: 'projscan://nope' },
    })) as { error: { code: number } };
    expect(response.error).toBeDefined();
  });
});
