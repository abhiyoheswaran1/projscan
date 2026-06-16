import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-taint-mcp-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
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
      params: { name: 'projscan_taint', arguments: args },
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

describe('projscan_taint MCP tool (1.6+)', () => {
  it('returns flows for the obvious source-to-sink case', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'a.ts'),
      `import { exec } from 'child_process';
export function run() {
  const cmd = process.env.MY_CMD;
  exec(cmd ?? 'echo hi');
}
`,
    );
    const server = createMcpServer(tmp);
    await init(server);
    const res = await call(server, 1);
    expect(res.available).toBe(true);
    expect((res.flows as unknown[]).length).toBeGreaterThan(0);
    const first = (res.flows as Array<Record<string, unknown>>)[0];
    expect(first.sourceFn).toBe('run');
    expect(first.sinkFn).toBe('run');
  });

  it('honors per-call additional sinks via args', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'b.ts'),
      `export function leak() {
  const v = process.env.X;
  customDangerousSink(v);
}
export function customDangerousSink(v: string | undefined) { return v; }
`,
    );
    const server = createMcpServer(tmp);
    await init(server);
    const empty = await call(server, 1);
    expect(empty.flowCount).toBe(0);
    const declared = await call(server, 2, { sinks: ['customDangerousSink'] });
    expect(declared.flowCount as number).toBeGreaterThan(0);
  });

  it('honors .projscanrc.json taint config', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({ taint: { sinks: ['customDangerousSink'] } }),
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'c.ts'),
      `export function leak() {
  const v = process.env.X;
  customDangerousSink(v);
}
export function customDangerousSink(v: string | undefined) { return v; }
`,
    );
    const server = createMcpServer(tmp);
    await init(server);
    const res = await call(server, 1);
    expect(res.flowCount as number).toBeGreaterThan(0);
  });
});
