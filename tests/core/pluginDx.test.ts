import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { initPlugin, testPlugin } from '../../src/core/pluginDx.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugin-dx-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('scaffolds an analyzer plugin that validates and tests cleanly', async () => {
  const result = await initPlugin(tmp, { kind: 'analyzer', name: 'policy' });

  expect(result.manifestPath).toContain('policy.projscan-plugin.json');
  const testResult = await testPlugin(result.manifestPath, { fixtureRoot: tmp });

  expect(testResult.ok).toBe(true);
  expect(testResult.diagnostics).toEqual([]);
  expect(testResult.analyzer?.issues).toEqual([]);
});

test('scaffolds a reporter plugin that renders supported sample payloads', async () => {
  const result = await initPlugin(tmp, { kind: 'reporter', name: 'team-report' });

  const testResult = await testPlugin(result.manifestPath, { fixtureRoot: tmp });

  expect(testResult.ok).toBe(true);
  expect(testResult.reporter?.outputs.map((output) => output.command)).toEqual([
    'doctor',
    'analyze',
    'ci',
  ]);
  expect(testResult.reporter?.outputs.every((output) => output.text.length > 0)).toBe(true);
});

test('plugin test reports missing analyzer exports with structured diagnostics', async () => {
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

  const result = await testPlugin(manifestPath, { fixtureRoot: tmp });

  expect(result.ok).toBe(false);
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-analyzer-export', severity: 'error' }),
    ]),
  );
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
