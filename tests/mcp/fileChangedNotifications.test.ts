import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-watch-'));
  await fs.writeFile(path.join(tmp, 'a.ts'), `export const a = 1;\n`, 'utf-8');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function rpc(
  server: ReturnType<typeof createMcpServer>,
  req: object,
): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(JSON.stringify(req));
  if (!raw) throw new Error('no response');
  return JSON.parse(raw) as Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('MCP notifications/file_changed (1.3+)', () => {
  it('does NOT advertise the experimental capability when watch is off', async () => {
    const server = createMcpServer(tmp);
    const init = await rpc(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });
    const result = init.result as { capabilities: Record<string, unknown> };
    expect(result.capabilities.experimental).toBeUndefined();
    server.close();
  });

  it('advertises experimental.fileChanged when watch is on', async () => {
    const notifications: string[] = [];
    const server = createMcpServer(tmp, {
      notify: (payload) => {
        notifications.push(payload);
      },
      watch: true,
    });
    const init = await rpc(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });
    const result = init.result as { capabilities: { experimental?: { fileChanged?: unknown } } };
    expect(result.capabilities.experimental?.fileChanged).toEqual({
      method: 'notifications/file_changed',
    });
    server.close();
  });

  it('emits notifications/file_changed on a real file change (watch on)', async () => {
    const notifications: string[] = [];
    const server = createMcpServer(tmp, {
      notify: (payload) => {
        notifications.push(payload);
      },
      watch: true,
    });

    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    // The watcher's initial scan needs a moment to complete before fs.watch
    // is registered. Poll briefly until there's a chance to receive events.
    await sleep(400);

    // Modify a file inside the watched root.
    await fs.writeFile(path.join(tmp, 'a.ts'), `export const a = 2;\n`, 'utf-8');

    // Wait for the 200ms debounce + processing.
    await sleep(800);

    const fileChanged = notifications
      .map((n) => JSON.parse(n) as Record<string, unknown>)
      .filter((n) => n.method === 'notifications/file_changed');

    expect(fileChanged.length).toBeGreaterThanOrEqual(1);
    const first = fileChanged[0];
    const params = first.params as {
      paths: string[];
      scannedFiles: number;
      timestampMs: number;
    };
    expect(Array.isArray(params.paths)).toBe(true);
    expect(params.paths).toContain('a.ts');
    expect(typeof params.scannedFiles).toBe('number');
    expect(typeof params.timestampMs).toBe('number');

    server.close();
  });

  it('does NOT emit notifications/file_changed when watch is off', async () => {
    const notifications: string[] = [];
    const server = createMcpServer(tmp, {
      notify: (payload) => {
        notifications.push(payload);
      },
      // watch: false (default)
    });

    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await sleep(200);
    await fs.writeFile(path.join(tmp, 'a.ts'), `export const a = 3;\n`, 'utf-8');
    await sleep(500);

    const fileChanged = notifications
      .map((n) => JSON.parse(n) as Record<string, unknown>)
      .filter((n) => n.method === 'notifications/file_changed');

    expect(fileChanged.length).toBe(0);
    server.close();
  });
});
