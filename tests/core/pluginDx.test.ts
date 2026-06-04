import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { initPlugin, testPlugin } from '../../src/core/pluginDx.js';

let tmp: string;
let originalPluginFlag: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugin-dx-'));
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

test('scaffolds an analyzer plugin that validates statically by default', async () => {
  const result = await initPlugin(tmp, { kind: 'analyzer', name: 'policy' });

  expect(result.manifestPath).toContain('policy.projscan-plugin.json');
  const testResult = await testPlugin(result.manifestPath, { fixtureRoot: tmp });

  expect(testResult.ok).toBe(true);
  expect(testResult.diagnostics).toEqual([]);
  expect(testResult.execution.executed).toBe(false);
  expect(testResult.trust.reminder).toContain('Local plugins execute code');
  expect(testResult.commands.validate).toContain('projscan plugin validate');
  expect(testResult.commands.test).toContain('projscan plugin test');
  expect(testResult.commands.execute).toContain('--execute');
  expect(testResult.context.requested).toBe(false);
  expect(testResult.analyzer).toBeUndefined();
});

test('plugin test does not import plugin modules unless execution is explicitly enabled', async () => {
  const markerPath = path.join(tmp, 'plugin-executed.txt');
  const manifestPath = await writePlugin({
    manifest: {
      schemaVersion: 1,
      name: 'marker',
      kind: 'analyzer',
      module: './broken.mjs',
      category: 'policy',
    },
    moduleSource: `import { writeFile } from 'node:fs/promises';
await writeFile(${JSON.stringify(markerPath)}, 'executed');
export default { check: async () => [] };
`,
  });

  const result = await testPlugin(manifestPath, { fixtureRoot: tmp });

  expect(result.ok).toBe(true);
  expect(result.execution.executed).toBe(false);
  await expect(fs.access(markerPath)).rejects.toThrow();
});

test('plugin test execute mode requires the preview flag before importing code', async () => {
  const markerPath = path.join(tmp, 'plugin-executed.txt');
  const manifestPath = await writePlugin({
    manifest: {
      schemaVersion: 1,
      name: 'marker',
      kind: 'analyzer',
      module: './broken.mjs',
      category: 'policy',
    },
    moduleSource: `import { writeFile } from 'node:fs/promises';
await writeFile(${JSON.stringify(markerPath)}, 'executed');
export default { check: async () => [] };
`,
  });

  const result = await testPlugin(manifestPath, { fixtureRoot: tmp, execute: true });

  expect(result.ok).toBe(false);
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'plugin-execution-disabled' })]),
  );
  expect(result.execution.executed).toBe(false);
  await expect(fs.access(markerPath)).rejects.toThrow();
});

test('plugin test execute mode runs analyzer checks when explicitly trusted', async () => {
  process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
  const result = await initPlugin(tmp, { kind: 'analyzer', name: 'policy' });

  const testResult = await testPlugin(result.manifestPath, { fixtureRoot: tmp, execute: true });

  expect(testResult.ok).toBe(true);
  expect(testResult.execution.executed).toBe(true);
  expect(testResult.analyzer?.issues).toEqual([]);
});

test('scaffolds a reporter plugin that renders supported sample payloads', async () => {
  process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
  const result = await initPlugin(tmp, { kind: 'reporter', name: 'team-report' });

  const testResult = await testPlugin(result.manifestPath, { fixtureRoot: tmp, execute: true });

  expect(testResult.ok).toBe(true);
  expect(testResult.execution.executed).toBe(true);
  expect(testResult.reporter?.outputs.map((output) => output.command)).toEqual([
    'doctor',
    'analyze',
    'ci',
  ]);
  expect(testResult.reporter?.outputs.every((output) => output.text.length > 0)).toBe(true);
});

test('plugin test reports graph context capability requests without execution', async () => {
  const manifestPath = await writePlugin({
    manifest: {
      schemaVersion: 1,
      name: 'graph-context',
      kind: 'analyzer',
      module: './broken.mjs',
      category: 'architecture',
    },
    moduleSource: `export default {
      async check(_rootPath, _files, context) {
        if (!context) return [];
        await context.getSemanticGraph();
        await context.getDataflow();
        return [];
      }
    };`,
  });

  const result = await testPlugin(manifestPath, { fixtureRoot: tmp });

  expect(result.ok).toBe(true);
  expect(result.execution.executed).toBe(false);
  expect(result.context.requested).toBe(true);
  expect(result.context.capabilities).toEqual(expect.arrayContaining(['semanticGraph', 'dataflow']));
});

test('plugin test reports missing analyzer exports with structured diagnostics', async () => {
  process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
  const manifestPath = await writePlugin({
    manifest: {
      schemaVersion: 1,
      name: 'broken',
      kind: 'analyzer',
      module: './broken.mjs',
      category: 'policy',
    },
    moduleSource: 'export default { nope: () => [] };',
  });

  const result = await testPlugin(manifestPath, { fixtureRoot: tmp, execute: true });

  expect(result.ok).toBe(false);
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-analyzer-export', severity: 'error' }),
    ]),
  );
  expect(result.execution.executed).toBe(true);
});

test('plugin init refuses to overwrite existing scaffold files', async () => {
  await initPlugin(tmp, { kind: 'analyzer', name: 'policy' });

  await expect(initPlugin(tmp, { kind: 'analyzer', name: 'policy' })).rejects.toThrow(
    /already exists/,
  );
});

async function writePlugin(input: { manifest: unknown; moduleSource: string }): Promise<string> {
  const pluginDir = path.join(tmp, '.projscan-plugins');
  await fs.mkdir(pluginDir, { recursive: true });
  const manifestPath = path.join(pluginDir, 'broken.projscan-plugin.json');
  await fs.writeFile(manifestPath, JSON.stringify(input.manifest), 'utf-8');
  await fs.writeFile(path.join(pluginDir, 'broken.mjs'), input.moduleSource, 'utf-8');
  return manifestPath;
}
