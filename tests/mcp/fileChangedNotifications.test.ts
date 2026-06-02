import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
vi.mock('../../src/core/watcher.js', () => ({
  startWatcher: (_rootPath: string, options: { onChange: (event: { paths: string[]; graph: { scannedFiles: number } }) => void | Promise<void> }) => {
    const graph = { scannedFiles: 1 };
    let closed = false;
    let deltaTimer: NodeJS.Timeout | null = null;
    const ready = (async () => {
      await options.onChange({ paths: [], graph });
      deltaTimer = setTimeout(() => {
        if (!closed) void options.onChange({ paths: ['src/a.ts'], graph });
      }, 10);
    })();
    return {
      close: () => {
        closed = true;
        if (deltaTimer) clearTimeout(deltaTimer);
      },
      get closed(): Promise<void> {
        return ready.then(() => undefined);
      },
      ready,
    };
  },
}));

import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-watch-'));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'a.ts'), `export const a = 1;\n`, 'utf-8');
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

function parseFileChangedNotifications(notifications: string[]): Array<Record<string, unknown>> {
  return notifications
    .map((n) => JSON.parse(n) as Record<string, unknown>)
    .filter((n) => n.method === 'notifications/file_changed');
}

async function waitForFileChangedNotification(
  notifications: string[],
  relPath: string,
  timeoutMs = 1_000,
): Promise<Record<string, unknown>[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const fileChanged = parseFileChangedNotifications(notifications);
    if (
      fileChanged.some((notification) => {
        const params = notification.params as { paths?: unknown };
        return Array.isArray(params.paths) && params.paths.includes(relPath);
      })
    ) {
      return fileChanged;
    }
    await sleep(25);
  }
  return parseFileChangedNotifications(notifications);
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

  it('emits notifications/file_changed when the watcher reports a file change', async () => {
    const notifications: string[] = [];
    const server = createMcpServer(tmp, {
      notify: (payload) => {
        notifications.push(payload);
      },
      watch: true,
    });

    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    const fileChanged = await waitForFileChangedNotification(notifications, 'src/a.ts');

    expect(fileChanged.length).toBeGreaterThanOrEqual(1);
    const first = fileChanged[0];
    const params = first.params as {
      paths: string[];
      scannedFiles: number;
      timestampMs: number;
    };
    expect(Array.isArray(params.paths)).toBe(true);
    expect(params.paths).toContain('src/a.ts');
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
    await fs.writeFile(path.join(tmp, 'src', 'a.ts'), `export const a = 3;\n`, 'utf-8');
    await sleep(500);

    const fileChanged = parseFileChangedNotifications(notifications);

    expect(fileChanged.length).toBe(0);
    server.close();
  });
});
