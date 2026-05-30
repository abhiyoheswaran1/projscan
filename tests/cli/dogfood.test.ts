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
let repoA: string;
let repoB: string;
let repoC: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-dogfood-'));
  repoA = await makeRepo('api');
  repoB = await makeRepo('web');
  repoC = await makeRepo('worker');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('dogfood renders multi-repo usefulness evidence as JSON', async () => {
  const result = await runCli([
    'dogfood',
    '--repo',
    repoA,
    '--repo',
    repoB,
    '--repo',
    repoC,
    '--target-repos',
    '5',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.repos).toHaveLength(3);
  expect(report.targetRepoCount).toBe(5);
  expect(report.summary).toContain('needs more repos');
  expect(report.totals.prCommentReady).toBe(3);
  expect(report.suggestedNextActions.map((action: { command?: string }) => action.command)).toContain(
    'projscan dogfood --repo <path-to-repo> --format json',
  );
});

async function makeRepo(name: string): Promise<string> {
  const root = path.join(tmp, name);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name, version: '0.0.0', type: 'module' }, null, 2) + '\n',
  );
  await fs.writeFile(path.join(root, 'README.md'), '# ' + name + '\n');
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

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
