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

test('feedback intake classifies pasted feedback and can append it to the feedback artifact', async () => {
  const feedbackPath = path.join(tmp, '.projscan-feedback.json');

  const intake = await runCli([
    'feedback',
    'intake',
    '--text',
    'unused-exports false positive: a symbol imported through @/lib/foo is flagged unused',
    '--file',
    feedbackPath,
    '--append',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(intake.exitCode).toBe(0);
  const report = JSON.parse(intake.stdout);
  expect(report).toMatchObject({
    category: 'false_positive',
    confidence: 'high',
    appended: {
      path: feedbackPath,
      responses: 1,
    },
  });
  expect(report.agentloopTaskCommand).toContain(
    'npm exec agentloop -- create-task --type bugfix',
  );
  expect(report.feedbackSummaryCommand).toBe(
    'projscan feedback summary --file ' + feedbackPath + ' --format json',
  );
  expect(report.dogfoodCommand).toBe(
    'projscan dogfood --feedback ' + feedbackPath + ' --format json',
  );
  expect(report.followUpCommands).toEqual(
    expect.arrayContaining([
      report.agentloopTaskCommand,
      report.feedbackSummaryCommand,
      report.dogfoodCommand,
    ]),
  );
  expect(report.feedbackResponse.falsePositiveRules).toContain('unused-exports');

  const saved = JSON.parse(await fs.readFile(feedbackPath, 'utf8'));
  expect(saved.responses).toHaveLength(1);
  expect(saved.responses[0].falsePositiveRules).toContain('unused-exports');
});

test('feedback intake console prints task and dogfood follow-up commands', async () => {
  const feedbackPath = path.join(tmp, '.projscan-feedback.json');

  const intake = await runCli([
    'feedback',
    'intake',
    '--text',
    'caution output is noisy background noise in every PR',
    '--file',
    feedbackPath,
    '--append',
    '--quiet',
  ]);

  expect(intake.exitCode).toBe(0);
  expect(intake.stdout).toContain('task command:');
  expect(intake.stdout).toContain('npm exec agentloop -- create-task --type bugfix');
  expect(intake.stdout).toContain('verify:');
  expect(intake.stdout).toContain('dogfood:');
  expect(intake.stdout).toContain(
    'projscan dogfood --feedback ' + feedbackPath + ' --format json',
  );
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
