import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;
let originalPluginFlag: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-plugin-dx-'));
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

test('plugin init and plugin test validate statically through the CLI by default', async () => {
  const init = await runCli([
    'plugin',
    'init',
    '--kind',
    'analyzer',
    '--name',
    'policy',
    '--quiet',
  ]);

  expect(init.exitCode).toBe(0);
  expect(init.stdout).toContain('policy.projscan-plugin.json');

  const testResult = await runCli([
    'plugin',
    'test',
    '.projscan-plugins/policy.projscan-plugin.json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(testResult.exitCode).toBe(0);
  const payload = JSON.parse(testResult.stdout);
  expect(payload.ok).toBe(true);
  expect(payload.diagnostics).toEqual([]);
  expect(payload.execution.executed).toBe(false);
  expect(payload.trust.reminder).toContain('Local plugins execute code');
  expect(payload.commands.enable).toContain('PROJSCAN_PLUGINS_PREVIEW=1');
  expect(payload.commands.execute).toContain('--execute');
  expect(payload.context.requested).toBe(false);
  expect(payload.analyzer).toBeUndefined();
});

test('plugin test executes through the CLI only with preview flag and --execute', async () => {
  await runCli(['plugin', 'init', '--kind', 'analyzer', '--name', 'policy', '--quiet']);

  const testResult = await runCli(
    [
      'plugin',
      'test',
      '.projscan-plugins/policy.projscan-plugin.json',
      '--execute',
      '--format',
      'json',
      '--quiet',
    ],
    { PROJSCAN_PLUGINS_PREVIEW: '1' },
  );

  expect(testResult.exitCode).toBe(0);
  const payload = JSON.parse(testResult.stdout);
  expect(payload.ok).toBe(true);
  expect(payload.execution.executed).toBe(true);
  expect(payload.analyzer.issues).toEqual([]);
});

test('plugin test does not import plugin modules without --execute', async () => {
  const markerPath = path.join(tmp, 'plugin-executed.txt');
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
export default { check: async () => [] };
`,
  );

  const result = await runCli([
    'plugin',
    'test',
    '.projscan-plugins/marker.projscan-plugin.json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.execution.executed).toBe(false);
  await expect(fs.access(markerPath)).rejects.toThrow();
});

test('plugin test --execute fails closed when the preview flag is absent', async () => {
  const markerPath = path.join(tmp, 'plugin-executed.txt');
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
export default { check: async () => [] };
`,
  );

  const result = await runCli([
    'plugin',
    'test',
    '.projscan-plugins/marker.projscan-plugin.json',
    '--execute',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stdout);
  expect(payload.ok).toBe(false);
  expect(payload.diagnostics).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'plugin-execution-disabled' })]),
  );
  expect(payload.execution.executed).toBe(false);
  await expect(fs.access(markerPath)).rejects.toThrow();
});

test('plugin test exits non-zero and prints JSON diagnostics for broken plugins in execute mode', async () => {
  const pluginDir = path.join(tmp, '.projscan-plugins');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'broken.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'broken',
      kind: 'analyzer',
      module: './broken.mjs',
      category: 'policy',
    }),
  );
  await fs.writeFile(path.join(pluginDir, 'broken.mjs'), 'export default { nope: () => [] };');

  const result = await runCli(
    [
      'plugin',
      'test',
      '.projscan-plugins/broken.projscan-plugin.json',
      '--execute',
      '--format',
      'json',
      '--quiet',
    ],
    { PROJSCAN_PLUGINS_PREVIEW: '1' },
  );

  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stdout);
  expect(payload.ok).toBe(false);
  expect(payload.execution.executed).toBe(true);
  expect(payload.diagnostics).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'invalid-analyzer-export' })]),
  );
});

async function runCli(
  args: string[],
  env: Record<string, string | undefined> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp, env: { ...process.env, ...env } });
}
