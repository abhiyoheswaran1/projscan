import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-simulate-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        type: 'module',
        scripts: { test: 'vitest run' },
        devDependencies: { vitest: '^3.0.0' },
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
  await fs.mkdir(path.join(tmp, 'src/core'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    "export function buildBugHuntReport(findings: string[]): string[] { return findings; }\n",
  );
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.test.ts'),
    "import { buildBugHuntReport } from './bugHunt.js';\ntest('builds report', () => buildBugHuntReport([]));\n",
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('simulate renders risk delta JSON', async () => {
  const result = await runCli([
    'simulate',
    '--plan',
    'split bugHunt.ts into ranking, evidence, and output modules',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.verdict).toBe('worth-doing');
  expect(report.filesLikelyTouched[0].path).toBe('src/core/bugHunt.ts');
  expect(report.testsLikelyAffected).toContain('src/core/bugHunt.test.ts');
  expect(report.proofCommands).toContain(
    'projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules" --format json',
  );
});

test('simulate renders markdown', async () => {
  const result = await runCli([
    'simulate',
    '--plan',
    'split bugHunt.ts into ranking, evidence, and output modules',
    '--format',
    'markdown',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('# Projscan Simulate');
  expect(result.stdout).toContain('## Files Likely Touched');
  expect(result.stdout).toContain('## Rollout Plan');
});

test('simulate rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli([
    'simulate',
    '--plan',
    'split bugHunt.ts',
    '--format',
    'sarif',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan simulate does not support --format sarif');
});

test('simulate requires a plan', async () => {
  const result = await runCli(['simulate', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('required option');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp, maxBuffer: 4 * 1024 * 1024 });
}

