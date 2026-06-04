import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;
let originalPluginFlag: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-workplan-'));
  originalPluginFlag = process.env.PROJSCAN_PLUGINS_PREVIEW;
  delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  if (originalPluginFlag === undefined) delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  else process.env.PROJSCAN_PLUGINS_PREVIEW = originalPluginFlag;
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists projscan_workplan as an MCP tool', () => {
  const tools = getToolDefinitions();
  const names = tools.map((tool) => tool.name);
  const tool = tools.find((entry) => entry.name === 'projscan_workplan');

  expect(names).toContain('projscan_workplan');
  expect(tool?.inputSchema.properties).toEqual(
    expect.objectContaining({
      mode: expect.objectContaining({
        enum: expect.arrayContaining(['before_edit', 'release', 'bug_hunt', 'hardening']),
      }),
      max_tasks: expect.objectContaining({ type: 'number' }),
      enable_plugins: expect.objectContaining({
        type: 'boolean',
        description: expect.stringContaining('never enables plugin execution by itself'),
      }),
      max_tokens: expect.objectContaining({ type: 'number' }),
    }),
  );
});



test('projscan_workplan does not honor per-request plugin execution toggles', async () => {
  const markerPath = path.join(tmp, 'plugin-executed.txt');
  await writeMarkerPlugin(markerPath);
  const handler = getToolHandler('projscan_workplan');

  const result = (await handler?.({ mode: 'bug_hunt', enable_plugins: true }, tmp)) as {
    workplan: { verdict: string; topRisks: Array<{ source: string }> };
  };

  expect(result.workplan.verdict).not.toBe('block');
  expect(result.workplan.topRisks.some((risk) => risk.source === 'plugin')).toBe(false);
  await expect(fs.access(markerPath)).rejects.toThrow();
});

test('projscan_workplan returns an agent-ready task plan', async () => {
  const handler = getToolHandler('projscan_workplan');
  expect(handler).toBeDefined();

  const result = (await handler?.({ mode: 'bug_hunt', max_tasks: 3 }, tmp)) as {
    workplan: {
      schemaVersion: number;
      mode: string;
      tasks: Array<{ id: string; verification: { commands: string[] } }>;
      coordination: { touchedFiles: string[] };
    };
  };

  expect(result.workplan.schemaVersion).toBe(1);
  expect(result.workplan.mode).toBe('bug_hunt');
  expect(result.workplan.tasks.length).toBeGreaterThan(0);
  expect(result.workplan.tasks.length).toBeLessThanOrEqual(3);
  expect(result.workplan.tasks[0]?.verification.commands.length).toBeGreaterThan(0);
  expect(Array.isArray(result.workplan.coordination.touchedFiles)).toBe(true);
});


async function writeMarkerPlugin(markerPath: string): Promise<void> {
  const pluginDir = path.join(tmp, '.projscan-plugins');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'marker.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'marker',
      kind: 'analyzer',
      module: './marker.mjs',
      category: 'policy',
    }),
  );
  await fs.writeFile(
    path.join(pluginDir, 'marker.mjs'),
    `import { writeFile } from 'node:fs/promises';
await writeFile(${JSON.stringify(markerPath)}, 'executed');
export default {
  check: () => [{
    id: 'marker-policy',
    title: 'Marker policy',
    description: 'This should not execute from an MCP request toggle.',
    severity: 'error',
    category: 'policy',
    fixAvailable: false,
  }],
};
`,
  );
}
