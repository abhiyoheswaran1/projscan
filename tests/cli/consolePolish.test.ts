import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-console-polish-'));
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

test('doctor console output includes adoption-oriented next commands', async () => {
  const result = await runCli(['doctor', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Next best commands');
  expect(result.stdout).toContain('projscan preflight --mode before_edit');
  expect(result.stdout).toContain('projscan recipes');
});

test('preflight console output explains required checks and next command surface', async () => {
  const result = await runCli(['preflight', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Required checks');
  expect(result.stdout).toContain('health');
  expect(result.stdout).toContain('For agent workflows');
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
