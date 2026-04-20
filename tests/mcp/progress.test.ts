import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../../src/mcp/server.js';

async function rpc(
  server: ReturnType<typeof createMcpServer>,
  req: object,
): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(JSON.stringify(req));
  if (!raw) throw new Error('no response');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('MCP progress notifications', () => {
  it('emits progress events during tools/call when client supplies a token', async () => {
    const notifications: string[] = [];
    const server = createMcpServer(process.cwd(), {
      notify: (payload) => {
        notifications.push(payload);
      },
    });

    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    // projscan_hotspots emits progress at 4 coarse milestones
    await rpc(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'projscan_hotspots',
        arguments: { limit: 5, page_size: 5 },
        _meta: { progressToken: 'tok-123' },
      },
    });

    const progressNotifications = notifications
      .map((n) => JSON.parse(n) as Record<string, unknown>)
      .filter((n) => n.method === 'notifications/progress');

    expect(progressNotifications.length).toBeGreaterThanOrEqual(1);
    for (const n of progressNotifications) {
      const params = n.params as { progressToken: unknown; progress: unknown };
      expect(params.progressToken).toBe('tok-123');
      expect(typeof params.progress).toBe('number');
    }
  });

  it('does NOT emit progress when client omits progressToken', async () => {
    const notifications: string[] = [];
    const server = createMcpServer(process.cwd(), {
      notify: (payload) => {
        notifications.push(payload);
      },
    });

    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await rpc(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'projscan_hotspots', arguments: { limit: 5 } },
    });

    expect(notifications.length).toBe(0);
  });
});
