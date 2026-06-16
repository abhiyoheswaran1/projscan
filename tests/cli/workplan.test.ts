import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-workplan-'));
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

test('workplan renders machine-readable JSON for bug hunting', async () => {
  const result = await runCli([
    'workplan',
    '--mode',
    'bug_hunt',
    '--max-tasks',
    '3',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.mode).toBe('bug_hunt');
  expect(report.tasks.length).toBeGreaterThan(0);
  expect(report.tasks.length).toBeLessThanOrEqual(3);
});

test('handoff renders concise text for another agent', async () => {
  const result = await runCli(['handoff', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Agent Handoff');
  expect(result.stdout).toContain('Next');
});

test('handoff can write a markdown artifact for the next agent', async () => {
  const target = path.join(tmp, 'docs', 'agent-handoff.md');
  const result = await runCli(['handoff', '--write', target, '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Wrote handoff');
  const markdown = await fs.readFile(target, 'utf-8');
  expect(markdown).toContain('# Agent Handoff');
  expect(markdown).toContain('## Next');
  expect(markdown).toContain('projscan preflight --format json');
});

test('workplan rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['workplan', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan workplan does not support --format sarif');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
