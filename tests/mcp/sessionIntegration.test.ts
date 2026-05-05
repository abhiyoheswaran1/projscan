import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';
import { extractTouchedPaths } from '../../src/mcp/sessionTouchScanner.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-session-int-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0' }),
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'a.ts'), `export const a = 1;\n`);
  await fs.writeFile(path.join(tmp, 'src', 'b.ts'), `export const b = 2;\n`);
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

describe('extractTouchedPaths', () => {
  it('finds repo-relative paths under known keys', () => {
    const result = {
      file: 'src/a.ts',
      paths: ['src/b.ts', 'src/c.ts'],
      relativePath: 'src/d.ts',
      definitions: ['src/e.ts', 'src/f.ts'],
    };
    const found = extractTouchedPaths(result);
    expect(new Set(found)).toEqual(new Set(['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts', 'src/f.ts']));
  });

  it('rejects absolute paths and traversal', () => {
    const result = { paths: ['/etc/passwd', '../escape.ts', 'src/legit.ts'] };
    expect(extractTouchedPaths(result)).toEqual(['src/legit.ts']);
  });

  it('rejects URLs', () => {
    const result = { file: 'https://example.com/foo.ts' };
    expect(extractTouchedPaths(result)).toEqual([]);
  });

  it('handles nested arrays of objects', () => {
    const result = {
      reachable: [
        { file: 'src/a.ts', distance: 1 },
        { file: 'src/b.ts', distance: 2 },
      ],
    };
    expect(new Set(extractTouchedPaths(result))).toEqual(new Set(['src/a.ts', 'src/b.ts']));
  });

  it('caps at MAX_PATHS', () => {
    const big = Array.from({ length: 500 }, (_, i) => `src/file${i}.ts`);
    const found = extractTouchedPaths({ paths: big });
    expect(found.length).toBe(200);
  });
});

describe('MCP server auto-touch wiring (1.4+)', () => {
  it('records files surfaced by a tool result into the session', async () => {
    const server = createMcpServer(tmp);
    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    // projscan_structure returns a tree with relativePath fields throughout.
    await rpc(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'projscan_explain', arguments: { file: 'src/a.ts' } },
    });

    // Read the session via the projscan_session tool.
    const sessionResp = (await rpc(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'projscan_session', arguments: { action: 'current' } },
    })) as { result: { content: Array<{ text: string }> } };
    const summary = JSON.parse(sessionResp.result.content[0].text);
    expect(summary.touchedFileCount).toBeGreaterThan(0);
    expect(summary.eventCount).toBeGreaterThan(0);

    server.close();
  });

  it('does not pollute the session when the tool itself is projscan_session', async () => {
    const server = createMcpServer(tmp);
    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    // Call session tool — should NOT increment its own event/touch count.
    await rpc(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'projscan_session', arguments: { action: 'current' } },
    });

    const sessionResp = (await rpc(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'projscan_session', arguments: { action: 'current' } },
    })) as { result: { content: Array<{ text: string }> } };
    const summary = JSON.parse(sessionResp.result.content[0].text);
    expect(summary.eventCount).toBe(0);

    server.close();
  });

  it('reset action discards touched-file state', async () => {
    const server = createMcpServer(tmp);
    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    await rpc(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'projscan_explain', arguments: { file: 'src/a.ts' } },
    });
    const beforeReset = (await rpc(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'projscan_session', arguments: { action: 'current' } },
    })) as { result: { content: Array<{ text: string }> } };
    const before = JSON.parse(beforeReset.result.content[0].text);
    expect(before.touchedFileCount).toBeGreaterThan(0);

    await rpc(server, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'projscan_session', arguments: { action: 'reset' } },
    });

    const afterReset = (await rpc(server, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'projscan_session', arguments: { action: 'current' } },
    })) as { result: { content: Array<{ text: string }> } };
    const after = JSON.parse(afterReset.result.content[0].text);
    expect(after.touchedFileCount).toBe(0);
    expect(after.id).not.toBe(before.id);

    server.close();
  });

  it('touched action lists files with source labels', async () => {
    const server = createMcpServer(tmp);
    await rpc(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });

    await rpc(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'projscan_explain', arguments: { file: 'src/a.ts' } },
    });

    const touchedResp = (await rpc(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'projscan_session', arguments: { action: 'touched' } },
    })) as { result: { content: Array<{ text: string }> } };
    const touched = JSON.parse(touchedResp.result.content[0].text);
    expect(Array.isArray(touched.touched)).toBe(true);
    expect(touched.touched.length).toBeGreaterThan(0);
    expect(touched.touched[0]).toHaveProperty('file');
    expect(touched.touched[0]).toHaveProperty('source');
    expect(touched.touched[0].source).toBe('tool-result');

    server.close();
  });
});
