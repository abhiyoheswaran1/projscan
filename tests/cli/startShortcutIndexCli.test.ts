import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { expectedReviewPolicy } from '../helpers/startReviewGate.js';
import { runStartCli } from '../helpers/startCli.js';

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

test('start prints a shortcut index for the current mission when requested', async () => {
  const baseCommand =
    "projscan start --mode 'before_edit' --intent 'what breaks if I rename the auth token loader'";
  const shortcutCommand = (flag: string): string =>
    `projscan start ${flag} --mode 'before_edit' --intent 'what breaks if I rename the auth token loader'`;
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--shortcuts',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('Mission Shortcuts');
  expect(result.stdout).toContain('Current command:');
  expect(result.stdout).toContain('projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('Current MCP tool call:');
  expect(result.stdout).toContain(
    '{"tool":"projscan_search","args":{"query":"auth token loader"}}',
  );
  expect(result.stdout).toContain(shortcutCommand('--next-command'));
  expect(result.stdout).toContain(shortcutCommand('--next-tool-call'));
  expect(result.stdout).toContain(shortcutCommand('--ready-tool-calls'));
  expect(result.stdout).toContain(shortcutCommand('--proof-commands'));
  expect(result.stdout).toContain(shortcutCommand('--checklist'));
  expect(result.stdout).toContain(shortcutCommand('--resume-json'));
  expect(result.stdout).toContain(shortcutCommand('--handoff-json'));
  expect(result.stdout).toContain(
    "projscan start --save-mission .projscan/mission --mode 'before_edit' --intent 'what breaks if I rename the auth token loader'",
  );
  expect(result.stdout).toContain(shortcutCommand('--task-card'));
  expect(result.stdout).toContain(shortcutCommand('--review-gate'));
  expect(result.stdout).toContain(shortcutCommand('--review-gate-json'));
  expect(result.stdout).toContain(shortcutCommand('--review-policy'));
  expect(result.stdout).toContain(shortcutCommand('--review-replies'));
  expect(result.stdout).toContain(shortcutCommand('--runbook'));
  expect(result.stdout).toContain(shortcutCommand('--handoff-prompt'));
  expect(result.stdout).toContain(baseCommand);
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Run Cursor');
  expect(result.stdout).not.toContain('Ready Proof');
});

test('start prints a shortcut index as compact JSON when requested', async () => {
  const baseCommand =
    "projscan start --mode 'before_edit' --intent 'what breaks if I rename the auth token loader'";
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--shortcuts-json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).not.toContain('Mission Shortcuts');
  expect(result.stdout).not.toContain('Start:');
  const shortcuts = JSON.parse(result.stdout);
  expect(result.stdout).toBe(`${JSON.stringify(shortcuts)}\n`);
  expect(shortcuts.schemaVersion).toBe(1);
  expect(shortcuts.kind).toBe('projscan.start-shortcuts');
  expect(shortcuts.currentCommand).toBe('projscan search "auth token loader" --format json');
  expect(shortcuts.currentToolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(shortcuts.baseCommand).toBe(baseCommand);
  expect(shortcuts.shortcuts.map((entry: { id: string }) => entry.id)).toEqual([
    'next-command',
    'next-tool-call',
    'ready-tool-calls',
    'proof-commands',
    'checklist',
    'resume-json',
    'handoff-json',
    'mission-script',
    'save-mission',
    'task-card',
    'review-gate',
    'review-gate-json',
    'review-policy',
    'review-replies',
    'runbook',
    'handoff-prompt',
    'start',
  ]);
  expect(shortcuts.shortcuts[0]).toEqual({
    id: 'next-command',
    label: 'Current shell command',
    command:
      "projscan start --next-command --mode 'before_edit' --intent 'what breaks if I rename the auth token loader'",
    description: 'Print only the current Mission Control cursor command.',
  });
  expect(
    shortcuts.shortcuts.find((entry: { id: string }) => entry.id === 'mission-script'),
  ).toEqual({
    id: 'mission-script',
    label: 'Mission script',
    command:
      "projscan start --mission-script --mode 'before_edit' --intent 'what breaks if I rename the auth token loader'",
    description: 'Print the Mission Control shell script.',
  });
  expect(shortcuts.shortcuts.at(-1)).toEqual({
    id: 'start',
    label: 'Full start report',
    command: baseCommand,
    description: 'Print the full Mission Control start report.',
  });
});

test('start JSON keeps the full report when shortcuts-json index is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--shortcuts-json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.executionPlan.cursor.command).toBe(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.reviewGate.policy).toEqual(expectedReviewPolicy);
  expect(report.kind).not.toBe('projscan.start-shortcuts');
});

test('start JSON keeps the full report when shortcuts index is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--shortcuts',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.executionPlan.cursor.command).toBe(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
});

test('start uses narrower shortcut output before the shortcut index', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--proof-commands',
    '--shortcuts',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const proofCommands = result.stdout.trim().split('\n');
  expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(proofCommands).not.toContain('Mission Shortcuts');
  expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');
});


async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
