import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../../src/mcp/server.js';

async function roundtrip(server: ReturnType<typeof createMcpServer>, req: object): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(JSON.stringify(req));
  if (!raw) throw new Error('no response');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('MCP server budget sidecar', () => {
  it('wraps array results cleanly when truncated', async () => {
    // Register a one-off test tool via a direct MCP round-trip. We exercise
    // a tool that returns an array: projscan_search with a broad query has
    // output large enough to truncate under a tight max_tokens budget.
    // Instead of setting up a full repo, we use a very small max_tokens so
    // that ~any result gets truncated.
    const server = createMcpServer(process.cwd());
    await roundtrip(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    const resp = await roundtrip(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'projscan_search',
        arguments: { query: 'auth', scope: 'content', limit: 100, max_tokens: 20 },
      },
    });

    const result = resp.result as { content?: Array<{ text: string }> } | undefined;
    expect(result).toBeDefined();
    const text = result?.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text) as Record<string, unknown>;

    // If truncated, the response MUST still be a plain object with _budget
    // set - never an array-shaped blob with numeric keys.
    if (parsed._budget) {
      expect(typeof parsed).toBe('object');
      expect(Array.isArray(parsed)).toBe(false);
      // No numeric-string keys that would indicate an array got spread
      const keys = Object.keys(parsed);
      const numericKeys = keys.filter((k) => /^\d+$/.test(k));
      expect(numericKeys).toEqual([]);
    }
  });
});
