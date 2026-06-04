import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-start-'));
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

test('start renders machine-readable orientation JSON', async () => {
  const result = await runCli(['start', '--mode', 'bug_hunt', '--max-tasks', '2', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.firstTenMinutes.commands[0].command).toBe('projscan privacy-check --offline');
  expect(report.firstTenMinutes.commands.map((step: { command: string }) => step.command)).toContain('projscan evidence-pack --pr-comment');
  expect(report.coordinationHints.map((hint: { id: string }) => hint.id)).toContain('current-worktree-check');
  expect(report.nextActions.length).toBeGreaterThan(0);
});

test('start console shows the full first-ten-minutes path and coordination hints', async () => {
  const result = await runCli(['start', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('First 10 Minutes');
  expect(result.stdout).toContain('projscan privacy-check --offline');
  expect(result.stdout).toContain('projscan evidence-pack --pr-comment');
  expect(result.stdout).toContain('projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json');
  expect(result.stdout).toContain('Coordination Hints');
  expect(result.stdout).toContain('projscan preflight --mode before_edit --format json');
});

test('start rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['start', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan start does not support --format sarif');
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
