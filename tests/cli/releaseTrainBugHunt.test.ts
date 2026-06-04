import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-train-hunt-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '2.2.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('release-train renders JSON without changing package version', async () => {
  const result = await runCli(['release-train', '--line', '2.3.x', '--line', '2.4.x', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.plan.readOnly).toBe(true);
  expect(report.tracks.map((track: { line: string }) => track.line)).toEqual(['2.3.x', '2.4.x']);
  const pkg = JSON.parse(await fs.readFile(path.join(tmp, 'package.json'), 'utf-8')) as { version: string };
  expect(pkg.version).toBe('2.2.0');
});

test('bug-hunt renders JSON fix queue', async () => {
  const result = await runCli(['bug-hunt', '--max-findings', '3', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.fixQueue.length).toBeGreaterThan(0);
  expect(report.fixQueue.length).toBeLessThanOrEqual(3);
});

test('bug-hunt rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['bug-hunt', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan bug-hunt does not support --format sarif');
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
