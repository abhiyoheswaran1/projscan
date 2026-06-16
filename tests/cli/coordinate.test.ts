import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-coordinate-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
  await git(['init']);
  await git(['config', 'user.email', 'test@example.com']);
  await git(['config', 'user.name', 'Test']);
  await git(['add', '.']);
  await git(['commit', '-m', 'init']);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('coordinate console surfaces local evidence and validation commands', async () => {
  const result = await runCli(['coordinate', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Swarm coordination');
  expect(result.stdout).toContain('Evidence');
  expect(result.stdout).toContain('local-only');
  expect(result.stdout).toContain('projscan coordinate --format json');
  expect(result.stdout).toContain('projscan coordinate --watch --interval 5 --format json');
  expect(result.stdout).toContain('projscan agent-brief --format json');
  expect(result.stdout).toContain(
    'Current worktree evidence is read from local git/worktree state during this command.',
  );
  expect(result.stdout).toContain(
    'Remembered session context is read separately through projscan session and agent-brief coordination hints.',
  );
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
