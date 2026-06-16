import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-applyfix-mcp-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function init(server: ReturnType<typeof createMcpServer>): Promise<void> {
  await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }),
  );
}

async function callApplyFix(
  server: ReturnType<typeof createMcpServer>,
  id: number,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: 'projscan_apply_fix', arguments: args },
    }),
  );
  if (!raw) throw new Error('no response');
  const env = JSON.parse(raw) as { result: { content: Array<{ text: string }> } };
  return JSON.parse(env.result.content[0].text);
}

describe('projscan_apply_fix MCP tool (1.6+)', () => {
  it('returns applicable:false for an unknown issue id', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }));
    const server = createMcpServer(tmp);
    await init(server);
    const res = await callApplyFix(server, 1, { action: 'apply', issue_id: 'never-existed' });
    expect(res.ok).toBe(false);
    expect(res.applicable).toBe(false);
    expect(res.reason).toMatch(/No open issue/);
  });

  it('default action is dry-run (does not mutate disk)', async () => {
    // Set up a project with an unused dependency that will be detected
    // by collectIssues → matches the unused-dependency-* template.
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 't', dependencies: { 'never-imported-pkg': '^1.0.0' } }, null, 2),
    );
    await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'src', 'a.ts'), `export const a = 1;\n`);

    const server = createMcpServer(tmp);
    await init(server);
    const res = await callApplyFix(server, 1, {
      action: 'apply',
      issue_id: 'unused-dependency-never-imported-pkg',
    });
    // Should be a successful dry-run plan (applicable:true, ok:true,
    // applied:false). Disk must not have changed.
    expect(res.ok).toBe(true);
    expect(res.applicable).toBe(true);
    expect(res.applied).toBe(false);
    expect(res.summary).toBeTruthy();
    // Disk unchanged.
    const pkg = JSON.parse(await fs.readFile(path.join(tmp, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toHaveProperty('never-imported-pkg');
  });

  it('confirm:true applies the change and returns a rollback id (round-trip)', async () => {
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 't', dependencies: { 'never-imported-pkg': '^1.0.0' } }, null, 2),
    );
    await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'src', 'a.ts'), `export const a = 1;\n`);

    const server = createMcpServer(tmp);
    await init(server);
    const applied = await callApplyFix(server, 1, {
      action: 'apply',
      issue_id: 'unused-dependency-never-imported-pkg',
      confirm: true,
    });
    expect(applied.ok).toBe(true);
    expect(applied.applied).toBe(true);
    expect(applied.rollbackId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    // Dep should be removed.
    let pkg = JSON.parse(await fs.readFile(path.join(tmp, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).not.toHaveProperty('never-imported-pkg');

    // Round-trip: rollback restores.
    const undone = await callApplyFix(server, 2, {
      action: 'rollback',
      rollback_id: applied.rollbackId,
    });
    expect(undone.ok).toBe(true);
    pkg = JSON.parse(await fs.readFile(path.join(tmp, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toHaveProperty('never-imported-pkg', '^1.0.0');
  });

  it('rollback action without rollback_id throws (caller error)', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }));
    const server = createMcpServer(tmp);
    await init(server);
    const raw = await server.handleMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'projscan_apply_fix', arguments: { action: 'rollback' } },
      }),
    );
    if (!raw) throw new Error('no response');
    const env = JSON.parse(raw) as Record<string, unknown>;
    // The MCP server surfaces handler throws as either an error envelope
    // OR as a tool-result with isError:true. Accept either shape here —
    // the contract is "the call does not silently succeed".
    if (env.error) {
      const error = env.error as { message: string };
      expect(error.message).toMatch(/rollback_id/);
    } else {
      const result = env.result as { isError?: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/rollback_id/);
    }
  });

  it('apply action without issue_id throws (caller error)', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }));
    const server = createMcpServer(tmp);
    await init(server);
    const raw = await server.handleMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'projscan_apply_fix', arguments: { action: 'apply' } },
      }),
    );
    if (!raw) throw new Error('no response');
    const env = JSON.parse(raw) as Record<string, unknown>;
    if (env.error) {
      const error = env.error as { message: string };
      expect(error.message).toMatch(/issue_id/);
    } else {
      const result = env.result as { isError?: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/issue_id/);
    }
  });
});
