import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';
import { PLUGIN_TRUST_HOME_ENV, trustPlugin } from '../../src/core/pluginTrust.js';

let tmp: string;
let trustHome: string;
let originalFlag: string | undefined;
let originalTrustHome: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugin-mcp-'));
  trustHome = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugin-mcp-trust-'));
  originalFlag = process.env.PROJSCAN_PLUGINS_PREVIEW;
  originalTrustHome = process.env[PLUGIN_TRUST_HOME_ENV];
  process.env[PLUGIN_TRUST_HOME_ENV] = trustHome;
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0' }),
  );
  await fs.mkdir(path.join(tmp, '.projscan-plugins'), { recursive: true });
});

afterEach(async () => {
  if (originalFlag === undefined) delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  else process.env.PROJSCAN_PLUGINS_PREVIEW = originalFlag;
  if (originalTrustHome === undefined) delete process.env[PLUGIN_TRUST_HOME_ENV];
  else process.env[PLUGIN_TRUST_HOME_ENV] = originalTrustHome;
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.rm(trustHome, { recursive: true, force: true });
});

async function init(server: ReturnType<typeof createMcpServer>): Promise<void> {
  await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }),
  );
}

async function call(
  server: ReturnType<typeof createMcpServer>,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  );
  if (!raw) throw new Error('no response');
  const env = JSON.parse(raw) as { result: { content: Array<{ text: string }> } };
  return JSON.parse(env.result.content[0].text);
}

async function listTools(
  server: ReturnType<typeof createMcpServer>,
): Promise<Array<Record<string, unknown>>> {
  const raw = await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  );
  if (!raw) throw new Error('no response');
  const env = JSON.parse(raw) as { result: { tools: Array<Record<string, unknown>> } };
  return env.result.tools;
}

describe('projscan_plugin MCP tool', () => {
  it('describes the plugin tool as the stable local platform', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const tools = await listTools(server);
    const tool = tools.find((entry) => entry.name === 'projscan_plugin');
    expect(tool?.description).toContain('stable local analyzer and reporter plugins');
    expect(tool?.description).not.toContain('preview-only');
    expect(tool?.description).not.toContain('may shift before 2.0');
    server.close();
  });

  it('returns structured diagnostics from validate', async () => {
    const manifestPath = path.join(tmp, '.projscan-plugins', 'bad.projscan-plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: 1,
        name: 'bad plugin',
        kind: 'analyzer',
        module: './check.mjs',
        category: 'custom',
      }),
    );
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 'projscan_plugin', {
      action: 'validate',
      manifest_path: '.projscan-plugins/bad.projscan-plugin.json',
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'invalid-name',
        field: 'name',
      },
    });
    server.close();
  });

  it('rejects absolute manifest paths outside the project plugin directory', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugin-outside-'));
    try {
      const manifestPath = path.join(outside, 'outside.projscan-plugin.json');
      await fs.writeFile(
        manifestPath,
        JSON.stringify({
          schemaVersion: 1,
          name: 'outside',
          kind: 'analyzer',
          module: './outside.mjs',
          category: 'custom',
        }),
      );
      const server = createMcpServer(tmp);
      await init(server);
      const result = await call(server, 'projscan_plugin', {
        action: 'validate',
        manifest_path: manifestPath,
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostic: { code: 'invalid-manifest-path' },
      });
      server.close();
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('rejects manifest validation paths containing traversal segments', async () => {
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 'projscan_plugin', {
      action: 'validate',
      manifest_path: '.projscan-plugins/../package.json',
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostic: { code: 'invalid-manifest-path' },
    });
    server.close();
  });

  it('includes diagnostics in list results', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'broken.projscan-plugin.json'),
      '{ not json',
      'utf-8',
    );
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 'projscan_plugin', { action: 'list' });
    const plugins = result.plugins as Array<Record<string, unknown>>;
    expect(plugins[0]).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'invalid-json',
      },
    });
    server.close();
  });

  it('lists and validates reporter plugin manifests', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'team-summary.projscan-plugin.json'),
      JSON.stringify({
        schemaVersion: 1,
        name: 'team-summary',
        kind: 'reporter',
        module: './team-summary.mjs',
        commands: ['doctor', 'analyze', 'ci'],
      }),
    );
    const server = createMcpServer(tmp);
    await init(server);
    const listed = await call(server, 'projscan_plugin', { action: 'list' });
    const plugins = listed.plugins as Array<Record<string, unknown>>;
    expect(plugins[0]).toMatchObject({
      ok: true,
      name: 'team-summary',
      kind: 'reporter',
      module: './team-summary.mjs',
      commands: ['doctor', 'analyze', 'ci'],
    });

    const validated = await call(server, 'projscan_plugin', {
      action: 'validate',
      manifest_path: '.projscan-plugins/team-summary.projscan-plugin.json',
    });
    expect(validated).toMatchObject({
      ok: true,
      manifest: {
        name: 'team-summary',
        kind: 'reporter',
        commands: ['doctor', 'analyze', 'ci'],
      },
    });
    server.close();
  });

  it('enabled plugin issues appear in MCP doctor and analyze output', async () => {
    process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
    await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'src', 'a.ts'), 'export const a = 1;\n');
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.projscan-plugin.json'),
      JSON.stringify({
        schemaVersion: 1,
        name: 'policy',
        kind: 'analyzer',
        module: './policy.mjs',
        category: 'custom',
      }),
    );
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.mjs'),
      `export default {
        check: async () => [{
          id: 'mcp-rule',
          title: 'MCP plugin rule',
          description: 'Visible through MCP.',
          severity: 'warning',
          category: 'custom',
          fixAvailable: false,
          locations: [{ file: 'src/a.ts', line: 1 }],
        }],
      };`,
    );
    await trustPlugin(path.join(tmp, '.projscan-plugins', 'policy.mjs'), 'policy');
    const server = createMcpServer(tmp);
    await init(server);
    const doctor = await call(server, 'projscan_doctor', {});
    const doctorIssues = doctor.issues as Array<{ id: string }>;
    expect(doctorIssues.some((i) => i.id === 'plugin:policy:mcp-rule')).toBe(true);
    const analyze = await call(server, 'projscan_analyze', {});
    const analyzeIssues = analyze.issues as Array<{ id: string }>;
    expect(analyzeIssues.some((i) => i.id === 'plugin:policy:mcp-rule')).toBe(true);
    server.close();
  });

  it('does NOT run an untrusted plugin through MCP doctor', async () => {
    process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
    await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'src', 'a.ts'), 'export const a = 1;\n');
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.projscan-plugin.json'),
      JSON.stringify({
        schemaVersion: 1,
        name: 'policy',
        kind: 'analyzer',
        module: './policy.mjs',
        category: 'custom',
      }),
    );
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.mjs'),
      `export default { check: async () => [{ id: 'mcp-rule', title: 't', description: 'd', severity: 'warning', category: 'custom', fixAvailable: false }] };`,
    );
    // Intentionally NOT trusted.
    const server = createMcpServer(tmp);
    await init(server);
    const doctor = await call(server, 'projscan_doctor', {});
    const doctorIssues = doctor.issues as Array<{ id: string }>;
    expect(doctorIssues.some((i) => i.id === 'plugin:policy:mcp-rule')).toBe(false);
    server.close();
  });

  it('reports per-plugin trust status in the list action', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.projscan-plugin.json'),
      JSON.stringify({
        schemaVersion: 1,
        name: 'policy',
        kind: 'analyzer',
        module: './policy.mjs',
        category: 'custom',
      }),
    );
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.mjs'),
      `export default { check: async () => [] };`,
    );
    const server = createMcpServer(tmp);
    await init(server);

    const before = await call(server, 'projscan_plugin', { action: 'list' });
    const beforePlugin = (before.plugins as Array<{ name?: string; trust?: string }>).find(
      (p) => p.name === 'policy',
    );
    expect(beforePlugin?.trust).toBe('untrusted');

    await trustPlugin(path.join(tmp, '.projscan-plugins', 'policy.mjs'), 'policy');

    const after = await call(server, 'projscan_plugin', { action: 'list' });
    const afterPlugin = (after.plugins as Array<{ name?: string; trust?: string }>).find(
      (p) => p.name === 'policy',
    );
    expect(afterPlugin?.trust).toBe('trusted');
    server.close();
  });
});
