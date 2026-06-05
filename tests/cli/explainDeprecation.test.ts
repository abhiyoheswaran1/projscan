import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

vi.setConfig({ testTimeout: 60000 });

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-explain-dep-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('explain prints a deprecation notice to stderr and still succeeds', async () => {
  const result = await spawnCli(cliPath, ['explain', 'src/index.ts', '--quiet'], { cwd: tmp });
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toMatch(/deprecated/i);
  expect(result.stderr).toMatch(/projscan file/);
});
