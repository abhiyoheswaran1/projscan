import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let workspaceRoot: string;
let sdkRepo: string;
let consumerRepo: string;

beforeEach(async () => {
  // Create three temp directories: workspace root + two sibling repos.
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-ws-graph-'));
  workspaceRoot = path.join(base, 'workspace-root');
  sdkRepo = path.join(base, 'sdk');
  consumerRepo = path.join(base, 'consumer');
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.mkdir(path.join(sdkRepo, 'src'), { recursive: true });
  await fs.mkdir(path.join(consumerRepo, 'src'), { recursive: true });

  // Workspace root needs a package.json so projscan recognizes it as a project.
  await fs.writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: 'workspace-root' }),
  );
  // SDK repo with a shared symbol "auth" exported.
  await fs.writeFile(path.join(sdkRepo, 'package.json'), JSON.stringify({ name: 'sdk' }));
  await fs.writeFile(
    path.join(sdkRepo, 'src', 'auth.ts'),
    `export function auth() { return 1; }\nexport const VERSION = '1.0';\n`,
  );
  // Consumer repo also exports an "auth" symbol — so "graph" view picks it up.
  await fs.writeFile(path.join(consumerRepo, 'package.json'), JSON.stringify({ name: 'consumer' }));
  await fs.writeFile(
    path.join(consumerRepo, 'src', 'index.ts'),
    `export function auth() { return 2; }\nexport const greet = () => 'hi';\n`,
  );

  // Register both repos with the trusted local workspace cache at workspaceRoot.
  const wsFile = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    repos: [
      { path: sdkRepo, name: 'sdk' },
      { path: consumerRepo, name: 'consumer' },
    ],
  };
  await fs.mkdir(path.join(workspaceRoot, '.projscan-cache'), { recursive: true });
  await fs.writeFile(
    path.join(workspaceRoot, '.projscan-cache', 'workspace.json'),
    JSON.stringify(wsFile),
  );
});

afterEach(async () => {
  // The base dir is the parent of all three; remove it.
  await fs.rm(path.dirname(workspaceRoot), { recursive: true, force: true });
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
      params: { name: 'projscan_workspace_graph', arguments: args },
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

describe('projscan_workspace_graph (1.6+)', () => {
  it('list returns the registered repos with parsedFiles + exports counts', async () => {
    const server = createMcpServer(workspaceRoot);
    await init(server);
    const result = await call(server, 1, { action: 'list' });
    expect(result.totalRepos).toBe(2);
    const repos = result.repos as Array<{ name: string; parsedFiles: number; exports: number }>;
    expect(repos.map((r) => r.name).sort()).toEqual(['consumer', 'sdk']);
    expect(repos.find((r) => r.name === 'sdk')?.parsedFiles).toBeGreaterThan(0);
    server.close();
  });

  it('graph returns symbols exported by ≥ 2 repos (the "auth" shared name)', async () => {
    const server = createMcpServer(workspaceRoot);
    await init(server);
    const result = await call(server, 1, { action: 'graph' });
    const shared = result.sharedSymbols as Array<{ symbol: string; repos: string[] }>;
    const authEntry = shared.find((s) => s.symbol === 'auth');
    expect(authEntry).toBeDefined();
    expect(authEntry!.repos.sort()).toEqual(['consumer', 'sdk']);
    // greet is only in consumer — should NOT appear.
    expect(shared.find((s) => s.symbol === 'greet')).toBeUndefined();
    server.close();
  });

  it('ignores checked-in project workspace files before scanning registered paths', async () => {
    const fresh = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-ws-untrusted-'));
    const root = path.join(fresh, 'root');
    const outside = path.join(fresh, 'nested', 'outside');
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(path.join(outside, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'root' }));
    await fs.writeFile(path.join(outside, 'package.json'), JSON.stringify({ name: 'outside' }));
    await fs.writeFile(path.join(outside, 'src', 'secret.ts'), 'export const secret = 1;\n');
    await fs.writeFile(
      path.join(root, '.projscan-workspace.json'),
      JSON.stringify({
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        repos: [{ path: outside, name: 'outside' }],
      }),
    );

    try {
      const server = createMcpServer(root);
      await init(server);
      const result = await call(server, 1, { action: 'list' });
      expect(result.available).toBe(false);
      expect(result.repos).toEqual([]);
      server.close();
    } finally {
      await fs.rm(fresh, { recursive: true, force: true });
    }
  });

  it('returns unavailable when no workspace is registered', async () => {
    // Use a fresh dir with no .projscan-workspace.json.
    const fresh = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-ws-empty-'));
    await fs.writeFile(path.join(fresh, 'package.json'), JSON.stringify({ name: 'x' }));
    try {
      const server = createMcpServer(fresh);
      await init(server);
      const result = await call(server, 1, { action: 'list' });
      expect(result.available).toBe(false);
      expect(result.reason).toMatch(/No cross-repo workspace/);
      server.close();
    } finally {
      await fs.rm(fresh, { recursive: true, force: true });
    }
  });

  it('rejects unknown actions with a helpful error', async () => {
    const server = createMcpServer(workspaceRoot);
    await init(server);
    const raw = await server.handleMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'projscan_workspace_graph', arguments: { action: 'wibble' } },
      }),
    );
    if (!raw) throw new Error('no response');
    const env = JSON.parse(raw) as {
      result: { isError: boolean; content: Array<{ text: string }> };
    };
    expect(env.result.isError).toBe(true);
    expect(env.result.content[0].text).toMatch(/Unknown action/);
    server.close();
  });

  it('file_importers finds importers in sibling repos (1.6+ coverage)', async () => {
    // Make consumer import sdk/src/auth via a relative path that the
    // heuristic can match (`imp.source.endsWith(file)`).
    await fs.writeFile(
      path.join(consumerRepo, 'src', 'index.ts'),
      `import { auth } from '../../sdk/src/auth.ts';
export function callAuth() { return auth(); }
`,
    );
    const server = createMcpServer(workspaceRoot);
    await init(server);
    const result = await call(server, 1, {
      action: 'file_importers',
      file: 'src/auth.ts',
      repo: 'sdk',
    });
    expect(result.action).toBe('file_importers');
    expect(result.sourceRepo).toBe('sdk');
    const importers = result.importers as Array<{ repo: string; file: string }>;
    expect(importers.length).toBeGreaterThan(0);
    const consumerHit = importers.find((i) => i.repo === 'consumer');
    expect(consumerHit).toBeDefined();
    expect(consumerHit!.file).toBe('src/index.ts');
    server.close();
  });

  it('file_importers throws when `file` is missing (caller error)', async () => {
    const server = createMcpServer(workspaceRoot);
    await init(server);
    const raw = await server.handleMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'projscan_workspace_graph',
          arguments: { action: 'file_importers' },
        },
      }),
    );
    if (!raw) throw new Error('no response');
    const env = JSON.parse(raw) as {
      result: { isError: boolean; content: Array<{ text: string }> };
    };
    expect(env.result.isError).toBe(true);
    expect(env.result.content[0].text).toMatch(/file_importers requires/);
    server.close();
  });

  it('file_importers throws when `repo` is unknown (caller error)', async () => {
    const server = createMcpServer(workspaceRoot);
    await init(server);
    const raw = await server.handleMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'projscan_workspace_graph',
          arguments: { action: 'file_importers', file: 'src/auth.ts', repo: 'never-registered' },
        },
      }),
    );
    if (!raw) throw new Error('no response');
    const env = JSON.parse(raw) as {
      result: { isError: boolean; content: Array<{ text: string }> };
    };
    expect(env.result.isError).toBe(true);
    expect(env.result.content[0].text).toMatch(/not registered/);
    server.close();
  });
});
