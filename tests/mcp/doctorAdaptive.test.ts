import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-doctor-adapt-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0' }),
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'a.ts'), `export const a = 1;\n`);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function call(
  server: ReturnType<typeof createMcpServer>,
  id: number,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: 'projscan_doctor', arguments: args },
    }),
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

describe('projscan_doctor adaptive shaping (1.5+)', () => {
  it('returns full report (no tier) when no max_cost_tokens passed', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 1);
    expect(result.tier).toBeUndefined();
    expect(result.health).toBeDefined();
    expect(Array.isArray(result.issues)).toBe(true);
    server.close();
  });

  it('returns tier=verdict-only at low budget', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 1, { max_cost_tokens: 1500 });
    expect(result.tier).toBe('verdict-only');
    expect(result.health).toBeDefined();
    expect(result.counts).toBeDefined();
    // verdict-only must NOT include the heavy issue list.
    expect(result.issues).toBeUndefined();
    expect(result.topIssues).toBeUndefined();
    server.close();
  });

  it('returns tier=summary at mid budget', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 1, { max_cost_tokens: 5000 });
    expect(result.tier).toBe('summary');
    expect(result.health).toBeDefined();
    expect(result.counts).toBeDefined();
    expect(result.topIssues).toBeDefined();
    // Summary must NOT include the full issue list.
    expect(result.issues).toBeUndefined();
  });

  it('returns tier=full at large budget (with the full issues array)', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 1, { max_cost_tokens: 50000 });
    expect(result.tier).toBe('full');
    expect(Array.isArray(result.issues)).toBe(true);
    server.close();
  });

  it('treats max_cost_tokens=0 as no budget (returns full with tier=full)', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 1, { max_cost_tokens: 0 });
    expect(result.tier).toBe('full');
    server.close();
  });
});
