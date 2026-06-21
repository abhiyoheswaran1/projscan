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
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-codebase-health-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.projscan-cache/\n.projscan-memory/\n');
  await fs.mkdir(path.join(tmp, 'apps', 'web', 'src', 'data'), { recursive: true });
  await fs.writeFile(
    generatedPath(),
    [
      'export const codebaseHealth = {',
      '  score: 97,',
      "  generatedAt: 'fixture',",
      '} as const;',
      '',
    ].join('\n'),
  );
  await git(['init', '-q']);
  await git(['add', 'package.json', '.gitignore', 'apps/web/src/data/codebaseHealth.generated.ts']);
  await git(['commit', '-q', '-m', 'initial']);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('analyze does not rewrite tracked codebase health generated files', async () => {
  const before = await fs.readFile(generatedPath(), 'utf-8');

  const result = await spawnCli(cliPath, ['analyze', '--format', 'json', '--quiet'], {
    cwd: tmp,
    maxBuffer: 1024 * 1024 * 4,
  });

  expect(result.exitCode).toBe(0);
  await expect(fs.readFile(generatedPath(), 'utf-8')).resolves.toBe(before);
  expect(await gitStatus()).toBe('');
});

function generatedPath(): string {
  return path.join(tmp, 'apps', 'web', 'src', 'data', 'codebaseHealth.generated.ts');
}

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}

async function gitStatus(): Promise<string> {
  const result = await execFileAsync('git', ['status', '--short'], { cwd: tmp });
  return result.stdout;
}
