import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-feedback-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('feedback init, add, and summary produce reusable JSON evidence', async () => {
  const feedbackPath = path.join(tmp, '.projscan-feedback.json');

  const init = await runCli([
    'feedback',
    'init',
    '--output',
    feedbackPath,
    '--format',
    'json',
    '--quiet',
  ]);
  expect(init.exitCode).toBe(0);
  expect(JSON.parse(init.stdout)).toMatchObject({ path: feedbackPath, responses: [] });

  const add = await runCli([
    'feedback',
    'add',
    '--file',
    feedbackPath,
    '--repo',
    'api',
    '--pr',
    'https://github.com/acme/api/pull/1',
    '--reviewer',
    '@alice',
    '--useful',
    'true',
    '--minutes-saved',
    '14',
    '--prevented-bad-edit',
    '--owner-routing-clear',
    'true',
    '--next-command-clear',
    'true',
    '--false-positive-rule',
    'owner:vague',
    '--missing-signal',
    'security owner was unclear',
    '--noisy-finding',
    'generated file warning',
    '--format',
    'json',
    '--quiet',
  ]);
  expect(add.exitCode).toBe(0);
  expect(JSON.parse(add.stdout).responses).toHaveLength(1);

  const summary = await runCli([
    'feedback',
    'summary',
    '--file',
    feedbackPath,
    '--format',
    'json',
    '--quiet',
  ]);
  expect(summary.exitCode).toBe(0);
  const report = JSON.parse(summary.stdout);
  expect(report.responses).toBe(1);
  expect(report.minutesSaved.total).toBe(14);
  expect(report.preventedBadEdits).toBe(1);
  expect(report.falsePositive.noisyRules[0]).toEqual({ rule: 'owner:vague', count: 1 });
  expect(report.nextDogfoodCommand).toBe(
    'projscan dogfood --feedback ' + feedbackPath + ' --format json',
  );
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
