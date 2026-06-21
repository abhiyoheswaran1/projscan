import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-assess-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        type: 'module',
        devDependencies: { vitest: '^3.0.0' },
        eslintConfig: { root: true },
        prettier: {},
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(
    path.join(tmp, 'README.md'),
    '# fixture\n\nA fixture project with enough usage and verification notes for assessment.\n',
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
  await fs.writeFile(path.join(tmp, 'src', 'index.test.ts'), 'export const ok = true;\n');
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('assess renders proof-first JSON', async () => {
  const result = await runCli([
    'assess',
    '--goal',
    'make this repo safer to ship this week',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.goal).toBe('make this repo safer to ship this week');
  expect(report.answers.shipNow).toMatch(/preflight|proof commands/i);
  expect(Array.isArray(report.proofCards)).toBe(true);
  expect(report.commands).toContain('projscan assess --mode fix-first --format json');
});

test('assess fix-first renders markdown proof cards', async () => {
  const result = await runCli(['assess', '--mode', 'fix-first', '--format', 'markdown', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('# Projscan Assess');
  expect(result.stdout).toContain('## Proof Cards');
  expect(result.stdout).toContain('## Verification');
});

test('assess rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['assess', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan assess does not support --format sarif');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp, maxBuffer: 4 * 1024 * 1024 });
}

