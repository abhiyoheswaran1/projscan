import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { buildMissionScript } from '../../src/cli/commands/startMissionBundle.js';
import type { StartReport } from '../../src/types/start.js';
import { runScript, runStartCli } from '../helpers/startCli.js';
import {
  expectedReviewDecisionIds,
  expectedReviewDecisionReplies,
  expectedReviewPolicy,
  expectedReviewPromptReplies,
  expectedReviewReplyLines,
  expectedReviewReplyQuotes,
  expectedReviewReplyTextLines,
} from '../helpers/startReviewGate.js';

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

test('start writes a Mission Control bundle when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--save-mission',
    'artifacts/mission',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('Wrote Mission Control bundle to');
  expect(result.stdout).toContain('README.md');
  expect(result.stdout).toContain('next-command.txt');
  expect(result.stdout).toContain('next-tool-call.json');
  expect(result.stdout).toContain('handoff-prompt.txt');
  expect(result.stdout).toContain('resume-prompt.txt');
  expect(result.stdout).toContain('task-card.md');
  expect(result.stdout).toContain('review-gate.md');
  expect(result.stdout).toContain('review-gate.json');
  expect(result.stdout).toContain('review-policy.json');
  expect(result.stdout).toContain('review-replies.txt');
  expect(result.stdout).toContain('runbook.md');
  expect(result.stdout).toContain('handoff.json');
  expect(result.stdout).toContain('resume.json');
  expect(result.stdout).toContain('ready-tool-calls.json');
  expect(result.stdout).toContain('shortcuts.json');
  expect(result.stdout).toContain('mission.sh');
  expect(result.stdout).toContain('status.sh');
  expect(result.stdout).toContain('review.sh');
  expect(result.stdout).toContain('proof-logs/README.md');
  expect(result.stdout).toContain('proof-logs/status.jsonl');
  expect(result.stdout).toContain('proof-logs/run-report.md');
  expect(result.stdout).toContain('proof-logs/summary.json');
  expect(result.stdout).toContain('proof-commands.txt');
  expect(result.stdout).toContain('manifest.json');

  const bundleDir = path.join(tmp, 'artifacts', 'mission');
  const quickstart = await fs.readFile(path.join(bundleDir, 'README.md'), 'utf-8');
  expect(quickstart).toContain('# Mission Bundle');
  expect(quickstart).toContain('Intent: what breaks if I rename the auth token loader');
  expect(quickstart).toContain('Status: needs_attention');
  expect(quickstart).toContain('Current step: ready-1 in ready_now');
  expect(quickstart).toContain('## Quick Commands');
  expect(quickstart).toContain('```sh\n./mission.sh\n./status.sh\n./review.sh\n```');
  expect(quickstart).toContain('- `./mission.sh` runs the current command and remaining proof.');
  expect(quickstart).toContain('- `./status.sh` prints the latest mission state and next action.');
  expect(quickstart).toContain('- `./review.sh` prints the review packet for approval.');
  expect(quickstart.indexOf('## Quick Commands')).toBeLessThan(quickstart.indexOf('## Run Next'));
  expect(quickstart.indexOf('## Run Next')).toBeLessThan(quickstart.indexOf('## Reviewer Replies'));
  expect(quickstart).toContain('```sh\nprojscan search "auth token loader" --format json\n```');
  expect(quickstart).toContain('MCP call: `projscan_search {"query":"auth token loader"}`');
  expect(quickstart).toContain(
    '- `handoff-prompt.txt`: Copyable prompt for handing this mission to another agent.',
  );
  expect(quickstart).toContain(
    '- `resume-prompt.txt`: Focused prompt for resuming the current cursor.',
  );
  expect(quickstart).toContain(
    '- `task-card.md`: Paste-ready Markdown task card for PRs, issues, and handoffs.',
  );
  expect(quickstart).toContain(
    '- `review-gate.md`: Stop-and-review gate for approving another slice, release, publish, or deploy.',
  );
  expect(quickstart).toContain(
    '- `review-gate.json`: Machine-readable review gate with policy, proof, decisions, and worktree evidence.',
  );
  expect(quickstart).toContain(
    '- `review-policy.json`: Machine-readable review approval boundary and blocked actions.',
  );
  expect(quickstart).toContain(
    '- `review-replies.txt`: Copy-only reviewer reply choices for approving or redirecting the stopped mission.',
  );
  expect(quickstart).toContain('- `runbook.md`: Human-readable Mission Control runbook.');
  expect(quickstart).toContain(
    '- `shortcuts.json`: Machine-readable Mission Control shortcut command index.',
  );
  expect(quickstart).toContain(
    '- `mission.sh`: Shell script that runs the current cursor command and remaining proof queue.',
  );
  expect(quickstart).toContain(
    '- `status.sh`: Shell script that prints the latest mission run state from summary.json.',
  );
  expect(quickstart).toContain(
    '- `review.sh`: Shell script that prints status, review evidence, run report, and reviewer replies.',
  );
  expect(quickstart).toContain(
    '- `proof-logs/README.md`: Proof-log index for output written by mission.sh.',
  );
  expect(quickstart).toContain(
    '- `proof-logs/status.jsonl`: Runtime status rows written by mission.sh.',
  );
  expect(quickstart).toContain(
    '- `proof-logs/run-report.md`: Human-readable run report refreshed by mission.sh.',
  );
  expect(quickstart).toContain(
    '- `proof-logs/summary.json`: Machine-readable mission run state refreshed by mission.sh.',
  );
  expect(quickstart).toContain('## Reviewer Replies');
  for (const replyLine of expectedReviewReplyLines) {
    expect(quickstart).toContain(replyLine);
  }
  expect(quickstart.indexOf('## Reviewer Replies')).toBeLessThan(quickstart.indexOf('## Files'));

  const nextCommand = await fs.readFile(path.join(bundleDir, 'next-command.txt'), 'utf-8');
  expect(nextCommand).toBe('projscan search "auth token loader" --format json\n');

  const nextToolCall = JSON.parse(
    await fs.readFile(path.join(bundleDir, 'next-tool-call.json'), 'utf-8'),
  );
  expect(nextToolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });

  const handoffPrompt = await fs.readFile(path.join(bundleDir, 'handoff-prompt.txt'), 'utf-8');
  expect(handoffPrompt).toContain('Resume: Resume at ready-1 in ready_now');
  expect(handoffPrompt).toContain('Ready proof: Ready-to-run proof commands');
  expect(handoffPrompt).toContain(
    'Review gate: Stop after the current Mission Control checklist and proof are complete.',
  );
  expect(handoffPrompt).toContain(expectedReviewPromptReplies[2]);
  expect(handoffPrompt.endsWith('\n')).toBe(true);

  const resumePrompt = await fs.readFile(path.join(bundleDir, 'resume-prompt.txt'), 'utf-8');
  expect(resumePrompt).toBe(
    'Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).\n',
  );

  const taskCard = await fs.readFile(path.join(bundleDir, 'task-card.md'), 'utf-8');
  expect(taskCard.startsWith('# Mission Task Card\n')).toBe(true);
  expect(taskCard).toContain('- [ ] Run `projscan search "auth token loader" --format json`');
  expect(taskCard).toContain('- [ ] `projscan preflight --mode before_edit --format json`');
  expect(taskCard).toContain('## Review Gate');
  expect(taskCard).toContain('## Handoff Prompt');
  expect(taskCard.endsWith('\n')).toBe(true);

  const reviewGate = await fs.readFile(path.join(bundleDir, 'review-gate.md'), 'utf-8');
  expect(reviewGate.startsWith('# Mission Review Gate\n')).toBe(true);
  expect(reviewGate).toContain('- [ ] Capture `git status --short`.');
  expect(reviewGate).toContain('- `git diff --stat`');
  expect(reviewGate).toContain('## Worktree Evidence');
  expect(reviewGate).toContain('Current worktree evidence');
  expect(reviewGate).toContain('## Proof Queue');
  expect(reviewGate).toContain(
    '- `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(reviewGate).toContain('## Done When');
  expect(reviewGate).toContain(
    '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(reviewGate).toContain('## Reviewer Decision');
  expect(reviewGate).toContain(
    '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
  );
  expect(reviewGate).toContain(expectedReviewReplyQuotes[0]);
  expect(reviewGate).toContain('## Review Policy');
  expect(reviewGate).toContain('Approval required: yes');
  expect(reviewGate).toContain('- Push (`push`)');
  expect(reviewGate).toContain('- Version bump (`version_bump`)');
  expect(reviewGate).toContain('Publishing still requires a separate explicit approval.');
  expect(reviewGate.endsWith('\n')).toBe(true);

  const reviewReplies = await fs.readFile(path.join(bundleDir, 'review-replies.txt'), 'utf-8');
  expect(reviewReplies).toBe([...expectedReviewReplyLines, ''].join('\n'));

  const reviewPolicy = JSON.parse(
    await fs.readFile(path.join(bundleDir, 'review-policy.json'), 'utf-8'),
  );
  expect(reviewPolicy).toEqual(expectedReviewPolicy);

  const runbook = await fs.readFile(path.join(bundleDir, 'runbook.md'), 'utf-8');
  expect(runbook).toContain('# Mission Runbook');
  expect(runbook).toContain('## Current Cursor');
  expect(runbook).toContain('## Review Gate');

  const handoff = JSON.parse(await fs.readFile(path.join(bundleDir, 'handoff.json'), 'utf-8'));
  expect(handoff.currentStep.stepId).toBe('ready-1');
  expect(handoff.resume.currentStep.stepId).toBe('ready-1');
  expect(handoff.reviewGate).toEqual(
    expect.objectContaining({
      title: 'Mission Review Gate',
      commands: ['git status --short', 'git diff --stat'],
    }),
  );
  expect(handoff.reviewGate.worktree.summary).toContain('Current worktree evidence');
  expect(handoff.reviewGate.proof.commands).toEqual(handoff.readyProof.commands);
  expect(handoff.reviewGate.proof.items).toEqual(handoff.readyProof.items);
  expect(handoff.reviewGate.proof.toolCalls).toEqual(handoff.readyProof.toolCalls);
  expect(handoff.reviewGate.doneWhen).toEqual(handoff.doneWhen);
  expect(handoff.reviewGate.decisions.map((decision: { id: string }) => decision.id)).toEqual(
    expectedReviewDecisionIds,
  );
  expect(handoff.reviewGate.decisions.map((decision: { reply: string }) => decision.reply)).toEqual(
    expectedReviewDecisionReplies,
  );
  expect(handoff.reviewGate.policy).toEqual(expectedReviewPolicy);
  expect(reviewPolicy).toEqual(handoff.reviewGate.policy);

  const reviewGateJson = JSON.parse(
    await fs.readFile(path.join(bundleDir, 'review-gate.json'), 'utf-8'),
  );
  expect(reviewGateJson).toEqual(handoff.reviewGate);

  const resume = JSON.parse(await fs.readFile(path.join(bundleDir, 'resume.json'), 'utf-8'));
  expect(resume.currentStep.stepId).toBe('ready-1');

  const readyToolCalls = JSON.parse(
    await fs.readFile(path.join(bundleDir, 'ready-tool-calls.json'), 'utf-8'),
  );
  expect(readyToolCalls[0]).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });

  const shortcuts = JSON.parse(await fs.readFile(path.join(bundleDir, 'shortcuts.json'), 'utf-8'));
  expect(shortcuts).toMatchObject({
    schemaVersion: 1,
    kind: 'projscan.start-shortcuts',
    currentCommand: 'projscan search "auth token loader" --format json',
    currentToolCall: {
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
    },
    baseCommand: "projscan start --intent 'what breaks if I rename the auth token loader'",
  });
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
  expect(
    shortcuts.shortcuts.find((entry: { id: string }) => entry.id === 'shortcuts-json'),
  ).toBeUndefined();
  expect(shortcuts.shortcuts.map((entry: { command: string }) => entry.command)).toContain(
    "projscan start --mission-script --intent 'what breaks if I rename the auth token loader'",
  );
  expect(shortcuts.shortcuts.map((entry: { command: string }) => entry.command)).toContain(
    "projscan start --review-gate-json --intent 'what breaks if I rename the auth token loader'",
  );

  const missionScript = await fs.readFile(path.join(bundleDir, 'mission.sh'), 'utf-8');
  expect(missionScript.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
  expect(missionScript).toContain("printf '%s\\n' 'projscan Mission Control'");
  expect(missionScript).toContain(
    "printf '%s\\n' 'Intent: what breaks if I rename the auth token loader'",
  );
  expect(missionScript).toContain("printf '%s\\n' 'Current step: ready-1 in ready_now'");
  expect(missionScript).toContain('MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)');
  expect(missionScript).toContain('PROOF_LOG_DIR="${MISSION_DIR}/proof-logs"');
  expect(missionScript).toContain('PROOF_STATUS_FILE="${PROOF_LOG_DIR}/status.jsonl"');
  expect(missionScript).toContain('PROOF_REPORT_FILE="${PROOF_LOG_DIR}/run-report.md"');
  expect(missionScript).toContain('PROOF_SUMMARY_FILE="${PROOF_LOG_DIR}/summary.json"');
  expect(missionScript).toContain('append_proof_ledger_row');
  expect(missionScript).toContain('"$PROJSCAN_NODE" "$PROJSCAN_CLI" prove --record-command "$command"');
  expect(missionScript).toContain('--record-source mission');
  expect(missionScript).not.toContain('PROOF_LEDGER_FILE="${PROJSCAN_ROOT}/.projscan/proof-ledger.jsonl"');
  expect(missionScript).not.toContain('const record = { schemaVersion: 1');
  expect(missionScript).toContain('mkdir -p "$PROOF_LOG_DIR"');
  expect(missionScript).toContain(': > "$PROOF_STATUS_FILE"');
  expect(missionScript).toContain(': > "$PROOF_REPORT_FILE"');
  expect(missionScript).toContain("printf '%s\\n' '# Mission Run Report'");
  expect(missionScript).toContain("printf '%s\\n' '| Step | Label | Exit | Log |'");
  expect(missionScript).toContain('"status":"running"');
  expect(missionScript).toContain('"status":"passed"');
  expect(missionScript).toContain('"status":"failed"');
  expect(missionScript).toContain(
    '"nextAction":"wait for ./mission.sh to finish, or inspect proof-logs/status.jsonl."',
  );
  expect(missionScript).toContain('"nextAction":"run ./review.sh and choose a reviewer reply."');
  expect(missionScript).toContain(
    '"nextAction":"inspect the failed log, fix the issue, then rerun ./mission.sh."',
  );
  expect(missionScript).toContain('"totalCommands":');
  expect(missionScript).toContain('"failedStep":');
  expect(missionScript).toContain('"exitCode":');
  expect(missionScript).toContain('> "$PROOF_SUMMARY_FILE"');
  expect(missionScript).toContain("printf '%s\\n' 'Run current command'");
  expect(missionScript).toContain('projscan search "auth token loader" --format json');
  expect(missionScript).toContain('> "$PROOF_LOG_DIR/current-ready-1.log" 2>&1');
  expect(missionScript).toContain('status=$?');
  expect(missionScript).toContain('>> "$PROOF_STATUS_FILE"');
  expect(missionScript).toContain('>> "$PROOF_REPORT_FILE"');
  expect(missionScript).toContain('"id":"current-ready-1"');
  expect(missionScript).toContain('"exitCode":');
  expect(missionScript).toContain(
    "printf '| %s | %s | %s | %s |\\n' 'current-ready-1' 'Run current command' \"$status\" 'proof-logs/current-ready-1.log'",
  );
  expect(missionScript).toContain("printf '%s\\n' '## Result'");
  expect(missionScript).toContain("printf '%s\\n' 'All current and proof commands exited 0.'");
  expect(missionScript).toContain("printf '%s\\n' 'Mission stopped before completion.'");
  expect(missionScript).toContain('printf \'%s\\n\' "Run report: ${PROOF_REPORT_FILE}"');
  expect(missionScript).toContain('Summary: ${PROOF_SUMMARY_FILE}');
  expect(missionScript).toContain('exit "$status"');
  expect(missionScript).toContain("printf '%s\\n' 'Run remaining proof'");
  expect(missionScript).toContain('projscan preflight --mode before_edit --format json');
  expect(missionScript).toContain('> "$PROOF_LOG_DIR/proof-1.log" 2>&1');
  expect(missionScript).toContain("printf '%s\\n' '## Review Gate'");
  expect(missionScript).toContain("printf '%s\\n' '- git status --short'");
  expect(missionScript).toContain("printf '%s\\n' '- git diff --stat'");
  expect(missionScript).toContain("printf '%s\\n' 'Review gate'");
  expect(missionScript).toContain("printf '%s\\n' 'Capture: git status --short'");
  expect(missionScript).not.toContain('Mission Control\nStatus:');
  expect(missionScript).not.toContain('Run Cursor');

  const statusScript = await fs.readFile(path.join(bundleDir, 'status.sh'), 'utf-8');
  expect(statusScript.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
  expect(statusScript).toContain('SUMMARY_FILE="${MISSION_DIR}/proof-logs/summary.json"');
  expect(statusScript).toContain('Node.js is required to read proof-logs/summary.json.');
  expect(statusScript).toContain('Mission status:');
  expect(statusScript).toContain('Report:');
  expect(statusScript).toContain('Status rows:');
  expect(statusScript).toContain('Failed step:');
  expect(statusScript).toContain('Exit code:');
  expect(statusScript).toContain('Log:');
  expect(statusScript).toContain('Next action:');
  expect(statusScript).toContain('run ./mission.sh to generate proof.');
  expect(statusScript).toContain('run ./review.sh and choose a reviewer reply.');
  expect(statusScript).toContain('inspect the failed log, fix the issue, then rerun ./mission.sh.');
  expect(statusScript).toContain(
    'process.exitCode = status === "passed" ? 0 : status === "failed" ? 1 : 2;',
  );

  const statusMode = (await fs.stat(path.join(bundleDir, 'status.sh'))).mode;
  expect(statusMode & 0o111).not.toBe(0);

  const reviewScript = await fs.readFile(path.join(bundleDir, 'review.sh'), 'utf-8');
  expect(reviewScript.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
  expect(reviewScript).toContain("printf '%s\\n' 'Mission Review'");
  expect(reviewScript).toContain('"${MISSION_DIR}/status.sh"');
  expect(reviewScript).toContain('status_code=$?');
  expect(reviewScript).toContain('review-gate.md');
  expect(reviewScript).toContain('proof-logs/run-report.md');
  expect(reviewScript).toContain('review-replies.txt');
  expect(reviewScript).toContain("printf '%s\\n' '- git status --short'");
  expect(reviewScript).toContain("printf '%s\\n' '- git diff --stat'");
  expect(reviewScript).toContain('exit "$status_code"');

  const reviewMode = (await fs.stat(path.join(bundleDir, 'review.sh'))).mode;
  expect(reviewMode & 0o111).not.toBe(0);

  const initialReview = await runScript(path.join(bundleDir, 'review.sh'), [], { cwd: bundleDir });
  expect(initialReview.exitCode).toBe(2);
  expect(initialReview.stdout).toContain('Mission Review');
  expect(initialReview.stdout).toContain('Mission status: not_run');
  expect(initialReview.stdout).toContain('Next action: run ./mission.sh to generate proof.');
  expect(initialReview.stdout).toContain('Review gate: review-gate.md');
  expect(initialReview.stdout).toContain('# Mission Review Gate');
  expect(initialReview.stdout).toContain('Run report: proof-logs/run-report.md');
  expect(initialReview.stdout).toContain('# Mission Run Report');
  expect(initialReview.stdout).toContain('Evidence commands');
  expect(initialReview.stdout).toContain('- git status --short');
  expect(initialReview.stdout).toContain('- git diff --stat');
  expect(initialReview.stdout).toContain('Reviewer replies:');
  expect(initialReview.stdout).toContain(expectedReviewReplyTextLines[0]);

  const proofLogReadme = await fs.readFile(
    path.join(bundleDir, 'proof-logs', 'README.md'),
    'utf-8',
  );
  expect(proofLogReadme).toContain('# Mission Proof Logs');
  expect(proofLogReadme).toContain(
    'Read `summary.json` for the latest not_run, running, passed, or failed state.',
  );
  expect(proofLogReadme).toContain(
    'Read `status.jsonl` for command exit codes after `mission.sh` runs.',
  );
  expect(proofLogReadme).toContain(
    '- `current-ready-1.log`: `projscan search "auth token loader" --format json`',
  );
  expect(proofLogReadme).toContain(
    '- `proof-1.log`: `projscan preflight --mode before_edit --format json`',
  );

  const proofStatus = await fs.readFile(
    path.join(bundleDir, 'proof-logs', 'status.jsonl'),
    'utf-8',
  );
  expect(proofStatus).toBe('');

  const proofRunReport = await fs.readFile(
    path.join(bundleDir, 'proof-logs', 'run-report.md'),
    'utf-8',
  );
  expect(proofRunReport).toContain('# Mission Run Report');
  expect(proofRunReport).toContain(
    'Run `./mission.sh` to refresh this report with command exit codes and log links.',
  );
  expect(proofRunReport).toContain('Review `status.jsonl` for machine-readable status rows.');

  const proofSummary = JSON.parse(
    await fs.readFile(path.join(bundleDir, 'proof-logs', 'summary.json'), 'utf-8'),
  );
  expect(proofSummary).toEqual({
    schemaVersion: 1,
    status: 'not_run',
    nextAction: 'run ./mission.sh to generate proof.',
    report: 'proof-logs/run-report.md',
    statusRows: 'proof-logs/status.jsonl',
  });

  const initialStatus = await runScript(path.join(bundleDir, 'status.sh'), [], { cwd: bundleDir });
  expect(initialStatus.exitCode).toBe(2);
  expect(initialStatus.stdout).toContain('Mission status: not_run');
  expect(initialStatus.stdout).toContain('Report: proof-logs/run-report.md');
  expect(initialStatus.stdout).toContain('Status rows: proof-logs/status.jsonl');
  expect(initialStatus.stdout).toContain('Next action: run ./mission.sh to generate proof.');

  await fs.writeFile(
    path.join(bundleDir, 'proof-logs', 'summary.json'),
    JSON.stringify({
      schemaVersion: 1,
      status: 'passed',
      report: 'proof-logs/run-report.md',
      statusRows: 'proof-logs/status.jsonl',
      totalCommands: 3,
      nextAction: 'open review mode now.',
    }) + '\n',
  );
  const passedStatus = await runScript(path.join(bundleDir, 'status.sh'), [], { cwd: bundleDir });
  expect(passedStatus.exitCode).toBe(0);
  expect(passedStatus.stdout).toContain('Mission status: passed');
  expect(passedStatus.stdout).toContain('Total commands: 3');
  expect(passedStatus.stdout).toContain('Next action: open review mode now.');

  await fs.writeFile(
    path.join(bundleDir, 'proof-logs', 'summary.json'),
    JSON.stringify({
      schemaVersion: 1,
      status: 'failed',
      report: 'proof-logs/run-report.md',
      statusRows: 'proof-logs/status.jsonl',
      failedStep: 'proof-1',
      exitCode: 7,
      log: 'proof-logs/proof-1.log',
    }) + '\n',
  );
  const failedStatus = await runScript(path.join(bundleDir, 'status.sh'), [], { cwd: bundleDir });
  expect(failedStatus.exitCode).toBe(1);
  expect(failedStatus.stdout).toContain('Mission status: failed');
  expect(failedStatus.stdout).toContain('Failed step: proof-1');
  expect(failedStatus.stdout).toContain('Exit code: 7');
  expect(failedStatus.stdout).toContain('Log: proof-logs/proof-1.log');
  expect(failedStatus.stdout).toContain(
    'Next action: inspect the failed log, fix the issue, then rerun ./mission.sh.',
  );

  const proofCommands = await fs.readFile(path.join(bundleDir, 'proof-commands.txt'), 'utf-8');
  expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');

  const manifest = JSON.parse(await fs.readFile(path.join(bundleDir, 'manifest.json'), 'utf-8'));
  expect(manifest).toMatchObject({
    schemaVersion: 1,
    kind: 'projscan.mission-bundle',
    mode: 'before_edit',
    status: 'needs_attention',
    currentStep: {
      phaseId: 'ready_now',
      stepId: 'ready-1',
      command: 'projscan search "auth token loader" --format json',
      toolCall: {
        tool: 'projscan_search',
        args: { query: 'auth token loader' },
      },
    },
  });
  expect(manifest.directory).toBe(await fs.realpath(bundleDir));
  expect(manifest.quickCommands).toEqual([
    {
      id: 'run',
      command: './mission.sh',
      description: 'Run the current command and remaining proof.',
    },
    {
      id: 'status',
      command: './status.sh',
      description: 'Print the latest mission state and next action.',
    },
    {
      id: 'review',
      command: './review.sh',
      description: 'Print the review packet for approval.',
    },
  ]);
  expect(manifest.files.map((file: { name: string }) => file.name)).toEqual([
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
    'runbook.md',
    'handoff.json',
    'resume.json',
    'ready-tool-calls.json',
    'shortcuts.json',
    'mission.sh',
    'status.sh',
    'review.sh',
    'proof-logs/README.md',
    'proof-logs/status.jsonl',
    'proof-logs/run-report.md',
    'proof-logs/summary.json',
    'proof-commands.txt',
    'manifest.json',
  ]);
});

test('mission script refuses shell control syntax before emitting runnable commands', () => {
  const unsafeCommands = [
    'projscan doctor; echo unsafe',
    'projscan doctor && echo unsafe',
    'projscan doctor | cat',
    'projscan doctor\n echo unsafe',
    'projscan doctor $(id)',
    'projscan doctor `id`',
  ];

  for (const command of unsafeCommands) {
    const script = buildMissionScript(startReportWithMissionCommand(command), [], {
      proofLogs: true,
    });

    expect(script).toContain('Blocked: mission command contains shell control syntax');
    expect(script).not.toContain(`\n${command}\n`);
  }
});

test('mission proof ledger recording uses the current projscan CLI path', () => {
  const script = buildMissionScript(
    startReportWithMissionCommand('node --version'),
    ['node --version'],
    { proofLogs: true },
  );

  expect(script).toContain('PROJSCAN_NODE=');
  expect(script).toContain('PROJSCAN_CLI=');
  expect(script).toContain('"$PROJSCAN_NODE" "$PROJSCAN_CLI" prove --record-command "$command"');
  expect(script).not.toContain('&& projscan prove --record-command');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}

function startReportWithMissionCommand(command: string): StartReport {
  return {
    mode: 'before_edit',
    missionControl: {
      intent: 'security test',
      status: 'ready',
      executionPlan: {
        cursor: {
          phaseId: 'ready_now',
          stepId: 'ready-1',
          label: 'Run current command',
          command,
        },
      },
      reviewGate: {
        stopCondition: 'Review gate',
        commands: ['git status --short'],
      },
    },
  } as StartReport;
}
