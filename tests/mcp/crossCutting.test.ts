import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cross-'));
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

async function call(
  server: ReturnType<typeof createMcpServer>,
  id: number,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
  );
  if (!raw) throw new Error('no response');
  const env = JSON.parse(raw) as { result: { content: Array<{ text: string }> } };
  return JSON.parse(env.result.content[0].text);
}

async function init(server: ReturnType<typeof createMcpServer>): Promise<void> {
  await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('cross-cutting: session × cost sidecar', () => {
  it('projscan_session results carry _cost like every other tool', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 1, 'projscan_session', { action: 'current' });
    expect(result._cost).toBeDefined();
    const cost = result._cost as { estimatedTokens: number };
    expect(cost.estimatedTokens).toBeGreaterThan(0);
    server.close();
  });

  it('reading the session via projscan_session does not auto-touch itself', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    // Two consecutive session reads — neither should add to the touched set
    // or the event log (the session tool is excluded from auto-touch).
    await call(server, 1, 'projscan_session', { action: 'current' });
    await call(server, 2, 'projscan_session', { action: 'current' });
    const summary = await call(server, 3, 'projscan_session', { action: 'current' });
    expect(summary.touchedFileCount).toBe(0);
    expect(summary.eventCount).toBe(0);
    server.close();
  });
});

describe('cross-cutting: session × watch (1.3 + 1.4)', () => {
  it('fs-watch events populate the session with source=fs-watch', async () => {
    const notifications: string[] = [];
    const server = createMcpServer(tmp, {
      notify: (payload) => notifications.push(payload),
      watch: true,
    });
    await init(server);
    // Initial scan + watcher startup.
    await sleep(400);
    // Modify a file inside the watched root.
    await fs.writeFile(path.join(tmp, 'src', 'a.ts'), `export const a = 99;\n`, 'utf-8');
    await sleep(800);

    // The session should now contain a fs-watch entry for src/a.ts.
    const touched = await call(server, 10, 'projscan_session', {
      action: 'touched',
      source: 'fs-watch',
    });
    const entries = (touched.touched as Array<{ file: string; source: string }>).filter(
      (t) => t.file === 'src/a.ts',
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].source).toBe('fs-watch');

    server.close();
  });
});

describe('cross-cutting: review tier × cost sidecar (1.5)', () => {
  it('tier marker appears at top level AND in _cost.tier', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 1, 'projscan_review', { max_cost_tokens: 1500 });
    expect(result.tier).toBe('verdict-only');
    const cost = result._cost as { tier?: string };
    expect(cost.tier).toBe('verdict-only');
    server.close();
  });
});
