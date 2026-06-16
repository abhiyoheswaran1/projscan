import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-graph-dataflow-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'util.ts'), 'export const token = "safe";\n');
  await fs.writeFile(
    path.join(tmp, 'src', 'bridge.ts'),
    `import { exec } from 'child_process';
import { token } from './util';

export function readSecret() {
  return process.env.TOKEN ?? token;
}

export function runDangerous(value: string | undefined) {
  exec(value ?? 'echo ok');
}

export function bridge() {
  const value = readSecret();
  return runDangerous(value);
}
`,
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('semantic-graph renders v3 graph JSON', async () => {
  const result = await runCli(['semantic-graph', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.schemaVersion).toBe(3);
  expect(payload.nodes.some((node: { id: string }) => node.id === 'file:src/bridge.ts')).toBe(true);
});

test('semantic-graph answers a targeted importer query from the CLI', async () => {
  const result = await runCli([
    'semantic-graph',
    '--query',
    'importers',
    '--file',
    'src/util.ts',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload).toEqual(
    expect.objectContaining({
      file: 'src/util.ts',
      importers: expect.arrayContaining(['src/bridge.ts']),
    }),
  );
});

test('dataflow renders bridge risk JSON', async () => {
  const result = await runCli(['dataflow', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.available).toBe(true);
  expect(payload.risks).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: 'bridge', bridgeFn: 'bridge' })]),
  );
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
