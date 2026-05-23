import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-graph-dataflow-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src', 'bridge.ts'),
    `import { exec } from 'child_process';

export function readSecret() {
  return process.env.TOKEN;
}

export function runDangerous(value: string | undefined) {
  exec(value ?? 'echo ok');
}

export function bridge() {
  const value = readSecret();
  return runDangerous(value);
}
`,
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function init(server: ReturnType<typeof createMcpServer>): Promise<void> {
  await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }),
  );
}

async function call(
  server: ReturnType<typeof createMcpServer>,
  id: number,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  );
  if (!raw) throw new Error('no response');
  const env = JSON.parse(raw) as { result: { content: Array<{ text: string }> } };
  return JSON.parse(env.result.content[0].text);
}

describe('semantic graph and dataflow MCP tools (3.0)', () => {
  it('registers the new tools', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const raw = await server.handleMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    );
    if (!raw) throw new Error('no response');
    const payload = JSON.parse(raw) as { result: { tools: Array<{ name: string }> } };
    const names = payload.result.tools.map((tool) => tool.name);

    expect(names).toContain('projscan_semantic_graph');
    expect(names).toContain('projscan_dataflow');
  });

  it('returns semantic graph and dataflow JSON', async () => {
    const server = createMcpServer(tmp);
    await init(server);

    const graph = await call(server, 1, 'projscan_semantic_graph', { max_nodes: 200, max_edges: 500 });
    expect(graph.schemaVersion).toBe(3);
    expect((graph.nodes as Array<{ id: string }>).some((node) => node.id === 'file:src/bridge.ts')).toBe(
      true,
    );

    const dataflow = await call(server, 2, 'projscan_dataflow', { max_risks: 20 });
    expect(dataflow.available).toBe(true);
    expect((dataflow.risks as Array<{ kind: string; bridgeFn?: string }>)).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'bridge', bridgeFn: 'bridge' })]),
    );
  });
});
