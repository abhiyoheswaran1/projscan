import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
const execFileAsync = promisify(execFile);

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-preflight-'));
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

test('preflight renders machine-readable JSON for before_edit', async () => {
  const result = await runCli([
    'preflight',
    '--mode',
    'before_edit',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.mode).toBe('before_edit');
  expect(['proceed', 'caution', 'block']).toContain(report.verdict);
  expect(report.summary).toContain(report.verdict);
});

test('preflight console labels scale-only caution as manual sign-off', async () => {
  await git(['init']);
  await git(['config', 'user.email', 'agent@example.com']);
  await git(['config', 'user.name', 'Agent']);
  await git(['add', '.']);
  await git(['commit', '-m', 'baseline']);
  await fs.writeFile(path.join(tmp, 'src', 'extra-a.ts'), 'export const a = 1;\n');
  await fs.writeFile(path.join(tmp, 'src', 'extra-b.ts'), 'export const b = 2;\n');
  await git(['add', '.']);
  await git(['commit', '-m', 'large handoff candidate']);

  const result = await runCli([
    'preflight',
    '--mode',
    'before_commit',
    '--base-ref',
    'HEAD~1',
    '--head-ref',
    'HEAD',
    '--max-changed-files',
    '1',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Preflight: manual sign-off');
  expect(result.stdout).toContain('manual review sign-off recommended');
  expect(result.stdout).not.toContain('Preflight: caution');
  expect(result.stdout).not.toContain('caution: manual review sign-off');
});

test('preflight rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['preflight', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan preflight does not support --format sarif');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}
