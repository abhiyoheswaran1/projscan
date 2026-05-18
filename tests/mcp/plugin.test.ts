import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;
let originalFlag: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugin-mcp-'));
  originalFlag = process.env.PROJSCAN_PLUGINS_PREVIEW;
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
  await fs.mkdir(path.join(tmp, '.projscan-plugins'), { recursive: true });
});

afterEach(async () => {
  if (originalFlag === undefined) delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  else process.env.PROJSCAN_PLUGINS_PREVIEW = originalFlag;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function init(server: ReturnType<typeof createMcpServer>): Promise<void> {
  await server.handleMessage(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }));
}

async function call(
  server: ReturnType<typeof createMcpServer>,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  );
  if (!raw) throw new Error('no response');
  const env = JSON.parse(raw) as { result: { content: Array<{ text: string }> } };
  return JSON.parse(env.result.content[0].text);
}

describe('projscan_plugin MCP tool', () => {
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

  it('includes diagnostics in list results', async () => {
    await fs.writeFile(path.join(tmp, '.projscan-plugins', 'broken.projscan-plugin.json'), '{ not json', 'utf-8');
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
});
