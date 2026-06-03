import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-plugin-dx-'));
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

test('plugin init and plugin test work through the CLI', async () => {
  const init = await runCli(['plugin', 'init', '--kind', 'analyzer', '--name', 'policy', '--quiet']);

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
  expect(payload.trust.reminder).toContain('Local plugins execute code');
  expect(payload.commands.enable).toContain('PROJSCAN_PLUGINS_PREVIEW=1');
  expect(payload.context.requested).toBe(false);
});

test('plugin test exits non-zero and prints JSON diagnostics for broken plugins', async () => {
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

  const result = await runCli([
    'plugin',
    'test',
    '.projscan-plugins/broken.projscan-plugin.json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stdout);
  expect(payload.ok).toBe(false);
  expect(payload.diagnostics).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'invalid-analyzer-export' })]),
  );
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: tmp,
      env: process.env,
      maxBuffer: 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}
