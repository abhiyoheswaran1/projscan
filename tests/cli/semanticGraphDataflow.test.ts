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
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-graph-dataflow-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src', 'bridge.ts'),
    `import { exec } from 'child_process';

export function readSecret() {
  return process.env.TOKEN;
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

test('dataflow renders bridge risk JSON', async () => {
  const result = await runCli(['dataflow', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.available).toBe(true);
  expect(payload.risks).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: 'bridge', bridgeFn: 'bridge' })]),
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
