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
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-init-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture' }));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('init preserves existing .gitignore content and ignores project memory', async () => {
  await fs.writeFile(path.join(tmp, '.gitignore'), 'node_modules/\n');

  const result = await runCli(['init', '--quiet']);

  expect(result.exitCode).toBe(0);
  await expect(fs.access(path.join(tmp, '.projscanrc.json'))).resolves.toBeUndefined();
  const gitignore = await fs.readFile(path.join(tmp, '.gitignore'), 'utf-8');
  expect(gitignore).toContain('node_modules/\n');
  expect(gitignore).toContain('.projscan-memory/\n');

  await runCli(['init', '--quiet']);
  const lines = (await fs.readFile(path.join(tmp, '.gitignore'), 'utf-8'))
    .split(/\r?\n/)
    .filter((line) => line === '.projscan-memory/');
  expect(lines).toHaveLength(1);
});

test('init team keeps generated project memory out of git status', async () => {
  await fs.writeFile(path.join(tmp, '.gitignore'), 'node_modules/\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
  await git(['init', '-q']);
  await git(['add', 'package.json', '.gitignore', 'src/index.ts']);
  await git(['commit', '-q', '-m', 'initial']);

  const result = await runCli([
    'init',
    'team',
    '--team',
    'platform',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  await expect(
    fs.access(path.join(tmp, '.projscan-memory', 'memory.json')),
  ).resolves.toBeUndefined();
  expect(await gitStatus()).not.toContain('.projscan-memory');
  expect(await fs.readFile(path.join(tmp, '.gitignore'), 'utf-8')).toContain('.projscan-memory/\n');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp, maxBuffer: 1024 * 1024 * 4 });
}

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}

async function gitStatus(): Promise<string> {
  const result = await execFileAsync('git', ['status', '--short'], { cwd: tmp });
  return result.stdout;
}
