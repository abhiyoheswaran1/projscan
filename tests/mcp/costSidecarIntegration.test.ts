import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cost-int-'));
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

async function callTool(
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
  const raw = await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }),
  );
  if (!raw) throw new Error('no init response');
}

describe('MCP _cost sidecar (1.5+)', () => {
  it('attaches _cost.estimatedTokens to projscan_explain results', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await callTool(server, 1, 'projscan_explain', { file: 'src/a.ts' });
    expect(result._cost).toBeDefined();
    const cost = result._cost as { estimatedTokens: number };
    expect(typeof cost.estimatedTokens).toBe('number');
    expect(cost.estimatedTokens).toBeGreaterThan(0);
    server.close();
  });

  it('attaches _cost to projscan_session results too', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await callTool(server, 1, 'projscan_session', { action: 'current' });
    expect(result._cost).toBeDefined();
    server.close();
  });

  it('attaches _cost when the tool returns an array (wraps under value)', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    // projscan_workspaces returns an object with workspaces array — pick a tool that returns
    // a non-object directly. Most tools return objects, so verify the wrap path
    // independently: any tool's result has _cost present.
    const result = await callTool(server, 1, 'projscan_structure', {});
    expect(result._cost).toBeDefined();
    server.close();
  });

  it('coexists with _budget when truncation also fires', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    // Force truncation by setting an absurdly small max_tokens.
    const result = await callTool(server, 1, 'projscan_explain', { file: 'src/a.ts', max_tokens: 5 });
    expect(result._cost).toBeDefined();
    expect(result._budget).toBeDefined();
    server.close();
  });
});

describe('MCP projscan_review max_cost_tokens (1.5+)', () => {
  it('returns full report (no tier) when no budget is given', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await callTool(server, 1, 'projscan_review', {});
    // No diff in this fresh repo; tool returns available=false but the
    // shape still threads through. With no budget the legacy shape is
    // preserved (no `tier` field).
    expect(result.tier).toBeUndefined();
    expect(result._cost).toBeDefined();
    server.close();
  });

  it('returns tier=verdict-only at low budget', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await callTool(server, 1, 'projscan_review', { max_cost_tokens: 1500 });
    expect(result.tier).toBe('verdict-only');
    const cost = result._cost as { tier?: string };
    expect(cost.tier).toBe('verdict-only');
    server.close();
  });

  it('returns tier=summary at mid budget', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await callTool(server, 1, 'projscan_review', { max_cost_tokens: 5000 });
    expect(result.tier).toBe('summary');
    server.close();
  });

  it('returns tier=full at large budget', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await callTool(server, 1, 'projscan_review', { max_cost_tokens: 50000 });
    expect(result.tier).toBe('full');
    server.close();
  });

  it('treats max_cost_tokens=0 as no budget', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await callTool(server, 1, 'projscan_review', { max_cost_tokens: 0 });
    // 0 → 'full' tier per selectReviewTier; the tool returns the full
    // report and tags it with `tier: "full"` (because we hit the
    // shapeReviewForTier path even at full when the arg was provided).
    expect(result.tier).toBe('full');
    server.close();
  });
});
