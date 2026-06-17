import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import {
  expectedReviewDecisionIds,
  expectedReviewPolicy,
  expectedReviewReplyLines,
  expectedReviewReplyQuotes,
} from '../helpers/startReviewGate.js';
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

test('start reports the Mission Control bundle as JSON when save-mission uses JSON format', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--save-mission',
    'artifacts/json-mission',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  const bundleDir = path.join(tmp, 'artifacts', 'json-mission');
  expect(payload.missionBundle.directory).toBe(await fs.realpath(bundleDir));
  expect(payload.missionBundle.quickCommands.map((entry: { id: string }) => entry.id)).toEqual([
    'run',
    'status',
    'review',
  ]);
  expect(
    payload.missionBundle.quickCommands.map((entry: { command: string }) => entry.command),
  ).toEqual(['./mission.sh', './status.sh', './review.sh']);
  expect(payload.missionBundle.files.map((file: { name: string }) => file.name)).toEqual(
    expect.arrayContaining([
      'README.md',
      'next-command.txt',
      'next-tool-call.json',
      'handoff-prompt.txt',
      'resume-prompt.txt',
      'task-card.md',
      'review-gate.md',
      'review-gate.json',
      'review-policy.json',
      'review-replies.txt',
      'shortcuts.json',
      'mission.sh',
      'status.sh',
      'review.sh',
      'proof-logs/README.md',
      'proof-logs/status.jsonl',
      'proof-logs/run-report.md',
      'proof-logs/summary.json',
      'manifest.json',
    ]),
  );
  const manifest = JSON.parse(await fs.readFile(path.join(bundleDir, 'manifest.json'), 'utf-8'));
  expect(manifest.directory).toBe(await fs.realpath(bundleDir));
});

test('start prints only the mission task card when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--task-card',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.startsWith('# Mission Task Card\n')).toBe(true);
  expect(result.stdout).toContain('Intent: what breaks if I rename the auth token loader');
  expect(result.stdout).toContain('Status: needs_attention');
  expect(result.stdout).toContain('Current step: ready-1 in ready_now');
  expect(result.stdout).toContain('## Do Next');
  expect(result.stdout).toContain('- [ ] Run `projscan search "auth token loader" --format json`');
  expect(result.stdout).toContain('(MCP: projscan_search {"query":"auth token loader"})');
  expect(result.stdout).toContain(
    '- [ ] Resolve `input-1` (`symbol`): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(result.stdout).toContain(
    '- [ ] After inputs, run `projscan impact --symbol <symbol-from-search> --format json`',
  );
  expect(result.stdout).toContain('## Proof');
  expect(result.stdout).toContain(
    '- [ ] `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.stdout).toContain(
    '- [ ] `projscan understand --view verify --format json` (MCP: projscan_understand {"view":"verify"})',
  );
  expect(result.stdout).toContain('## Done When');
  expect(result.stdout).toContain(
    '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(result.stdout).toContain('## Review Gate');
  expect(result.stdout).toContain(
    '- [ ] Stop and ask for approval before starting another slice, release, publish, or deploy.',
  );
  expect(result.stdout).toContain('## Reviewer Decision');
  expect(result.stdout).toContain(
    '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
  );
  expect(result.stdout).toContain(expectedReviewReplyQuotes[0]);
  expect(result.stdout).toContain('## Handoff Prompt');
  expect(result.stdout).toContain('Resume: Resume at ready-1 in ready_now');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout.endsWith('\n')).toBe(true);
});

test('start JSON exposes the same task card used by the CLI shortcut', async () => {
  const json = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--format',
    'json',
    '--quiet',
  ]);
  const shortcut = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--task-card',
    '--quiet',
  ]);

  expect(json.exitCode).toBe(0);
  expect(shortcut.exitCode).toBe(0);
  const report = JSON.parse(json.stdout);
  expect(shortcut.stdout).toBe(report.missionControl.taskCard.markdown);
});

test('start review-gate shortcut prints the structured review gate markdown', async () => {
  const json = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--format',
    'json',
    '--quiet',
  ]);
  const shortcut = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--review-gate',
    '--quiet',
  ]);

  expect(json.exitCode).toBe(0);
  expect(shortcut.exitCode).toBe(0);
  const report = JSON.parse(json.stdout);
  expect(shortcut.stdout).toBe(report.missionControl.reviewGate.markdown);
  expect(shortcut.stdout).toContain('# Mission Review Gate');
  expect(shortcut.stdout).toContain('## Worktree Evidence');
  expect(shortcut.stdout).toContain(report.missionControl.reviewGate.worktree.summary);
  expect(shortcut.stdout).toContain('## Proof Queue');
  expect(shortcut.stdout).toContain(
    '- `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(report.missionControl.reviewGate.proof.commands).toEqual(
    report.missionControl.resume.remainingProofCommands,
  );
  expect(shortcut.stdout).toContain('## Done When');
  expect(shortcut.stdout).toContain(
    '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(report.missionControl.reviewGate.doneWhen).toEqual(report.missionControl.successCriteria);
  expect(shortcut.stdout).toContain('## Reviewer Decision');
  expect(shortcut.stdout).toContain('## Review Policy');
  expect(shortcut.stdout).toContain('Approval required: yes');
  expect(shortcut.stdout).toContain('- Push (`push`)');
  expect(shortcut.stdout).toContain('- Version bump (`version_bump`)');
  expect(shortcut.stdout).toContain(
    '- [ ] Request changes: The agent must address review feedback before starting more scope.',
  );
  expect(shortcut.stdout).toContain(expectedReviewReplyQuotes[1]);
  expect(
    report.missionControl.reviewGate.decisions.map((decision: { id: string }) => decision.id),
  ).toEqual(expectedReviewDecisionIds);
  expect(shortcut.stdout).toContain(
    'Stop and ask for approval before starting another slice, release, publish, or deploy.',
  );
  expect(shortcut.stdout).not.toContain('Start:');
  expect(shortcut.stdout).not.toContain('Run Cursor');
  expect(shortcut.stdout).not.toContain('Ready Proof');
});

test('start prints only the review gate JSON when requested', async () => {
  const json = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--format',
    'json',
    '--quiet',
  ]);
  const shortcut = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--review-gate-json',
    '--quiet',
  ]);

  expect(json.exitCode).toBe(0);
  expect(shortcut.exitCode).toBe(0);
  expect(shortcut.stderr).toBe('');
  const report = JSON.parse(json.stdout);
  expect(shortcut.stdout).toBe(`${JSON.stringify(report.missionControl.reviewGate)}\n`);
  const reviewGate = JSON.parse(shortcut.stdout);
  expect(reviewGate.policy).toEqual(expectedReviewPolicy);
  expect(reviewGate.proof.commands).toEqual(report.missionControl.resume.remainingProofCommands);
  expect(reviewGate.worktree.summary).toContain('Current worktree evidence');
  expect(shortcut.stdout).not.toContain('Start:');
  expect(shortcut.stdout).not.toContain('\nMission Control\n');
});

test('start prints only reviewer replies when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--review-replies',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toBe([...expectedReviewReplyLines, ''].join('\n'));
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('# Mission Review Gate');
});

test('start prints only the review policy when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--review-policy',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toBe(`${JSON.stringify(expectedReviewPolicy)}\n`);
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('# Mission Review Gate');
});

test('start prints only the mission runbook when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--runbook',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.startsWith('# Mission Runbook\n')).toBe(true);
  expect(result.stdout).toContain('## Current Cursor');
  expect(result.stdout).toContain('## Resume');
  expect(result.stdout).toContain('## Handoff Prompt');
  expect(result.stdout).toContain('## Review Gate');
  expect(result.stdout).toContain('## Reviewer Decision');
  expect(result.stdout).toContain(
    '- [ ] Review version candidate: The agent may prepare release notes, version rationale, and remaining gates for review.',
  );
  expect(result.stdout).toContain(expectedReviewReplyQuotes[2]);
  expect(result.stdout).toContain('## Ready Commands');
  expect(result.stdout).toContain('## Proof Commands');
  expect(result.stdout).toContain('Resume checklist:');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Agent Runbook');
  expect(result.stdout).not.toContain('First 10 Minutes');
});

test('start prints a mission shell script when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--mission-script',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
  expect(result.stdout).toContain("printf '%s\\n' 'projscan Mission Control'");
  expect(result.stdout).toContain(
    "printf '%s\\n' 'Intent: what breaks if I rename the auth token loader'",
  );
  expect(result.stdout).toContain("printf '%s\\n' 'Mode: before_edit'");
  expect(result.stdout).toContain("printf '%s\\n' 'Status: needs_attention'");
  expect(result.stdout).toContain("printf '%s\\n' 'Current step: ready-1 in ready_now'");
  expect(result.stdout).toContain("printf '%s\\n' 'Run current command'");
  expect(result.stdout).toContain('projscan search "auth token loader" --format json');
  expect(result.stdout).toContain("printf '%s\\n' 'Run remaining proof'");
  expect(result.stdout).toContain('projscan preflight --mode before_edit --format json');
  expect(result.stdout).toContain("printf '%s\\n' 'Review gate'");
  expect(result.stdout).toContain(
    'Stop after the current Mission Control checklist and proof are complete.',
  );
  expect(result.stdout).toContain("printf '%s\\n' 'Capture: git status --short'");
  expect(result.stdout).toContain("printf '%s\\n' 'Capture: git diff --stat'");
  expect(result.stdout).not.toContain('PROOF_LOG_DIR');
  expect(result.stdout).not.toContain('PROOF_STATUS_FILE');
  expect(result.stdout).not.toContain('PROOF_REPORT_FILE');
  expect(result.stdout).not.toContain('PROOF_SUMMARY_FILE');
  expect(result.stdout).not.toContain('run-report.md');
  expect(result.stdout).not.toContain('summary.json');
  expect(result.stdout).not.toContain('Summary:');
  expect(result.stdout).not.toContain('Mission Run Report');
  expect(result.stdout).not.toContain('> "$PROOF_LOG_DIR/');
  expect(result.stdout).not.toContain('status=$?');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Run Cursor');
  expect(result.stdout).not.toContain('Ready Proof');
});

test('start mission script escapes shell expansion syntax in freeform intent text', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename auth $(echo boom) loader',
    '--mission-script',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
  expect(result.stdout).toContain('projscan search "auth \\$(echo boom) loader" --format json');
  expect(result.stdout).toContain('Run current command');
  expect(result.stdout).not.toContain('Blocked: mission command contains shell expansion syntax');
  expect(result.stdout).not.toContain('projscan search "auth $(echo boom) loader" --format json');
});

test('start JSON keeps the full report when mission-script is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--mission-script',
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
  expect(report.missionScript).toBeUndefined();
});

test('start uses narrower shortcut output before the mission script', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--proof-commands',
    '--mission-script',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const proofCommands = result.stdout.trim().split('\n');
  expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(proofCommands).not.toContain('#!/usr/bin/env sh');
  expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');
});

test('start JSON keeps the full report when runbook shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--runbook',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.runbook.markdown).toContain('# Mission Runbook');
  expect(report.missionControl.runbook.markdown).toContain('## Handoff Prompt');
  expect(report.missionControl.runbook.markdown).toContain('## Review Gate');
  expect(report.missionControl.runbook.markdown).toContain('## Reviewer Decision');
});


async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
