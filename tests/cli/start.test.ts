import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
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
  const result = await runCli([
    'start',
    '--mode',
    'bug_hunt',
    '--max-tasks',
    '2',
    '--intent',
    'find bugs to fix before the PR',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.missionControl.intent).toBe('find bugs to fix before the PR');
  expect(report.missionControl.routedIntent.tool).toBe('projscan_bug_hunt');
  expect(report.missionControl.primaryAction.command).toBe('projscan bug-hunt --format json');
  expect(report.missionControl.actionPlan[0].command).toBe('projscan bug-hunt --format json');
  expect(report.missionControl.readyActions[0].command).toBe('projscan bug-hunt --format json');
  expect(report.firstTenMinutes.commands[0].command).toBe('projscan privacy-check --offline');
  expect(report.firstTenMinutes.commands.map((step: { command: string }) => step.command)).toContain('projscan evidence-pack --pr-comment');
  expect(report.coordinationHints.map((hint: { id: string }) => hint.id)).toContain('current-worktree-check');
  expect(report.nextActions.length).toBeGreaterThan(0);
});

test('start infers bug-hunt and release workflows from intent when mode is omitted', async () => {
  const bugHunt = await runCli([
    'start',
    '--intent',
    'find bugs to fix before the PR',
    '--format',
    'json',
    '--quiet',
  ]);
  const release = await runCli([
    'start',
    '--intent',
    'prepare this branch for release',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(bugHunt.exitCode).toBe(0);
  expect(release.exitCode).toBe(0);
  const bugHuntReport = JSON.parse(bugHunt.stdout);
  const releaseReport = JSON.parse(release.stdout);
  expect(bugHuntReport.mode).toBe('bug_hunt');
  expect(bugHuntReport.modeSource).toBe('intent');
  expect(bugHuntReport.recommendedWorkflow.id).toBe('bug_hunt');
  expect(bugHuntReport.missionControl.readyActions[0].command).toBe('projscan bug-hunt --format json');
  expect(releaseReport.mode).toBe('release');
  expect(releaseReport.modeSource).toBe('intent');
  expect(releaseReport.recommendedWorkflow.id).toBe('release_approval');
  expect(releaseReport.firstTenMinutes.commands[2].command).toBe('projscan preflight --mode before_merge --format json');
  expect(releaseReport.missionControl.readyActions[0].command).toBe('projscan release-train --format json');
});

test('start infers the workflow mode from safety-gate intent when mode is omitted', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'is it safe to commit this change',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is it safe to commit this change');
  expect(report.recommendedWorkflow.id).toBe('pre_merge');
  expect(report.missionControl.primaryAction.command).toBe('projscan preflight --mode before_commit --format json');
  expect(report.missionControl.proofCommands).not.toContain('projscan preflight --mode before_edit --format json');
  expect(report.missionControl.successCriteria).toContain('projscan preflight --mode before_commit returns proceed or only documented manual-review items.');
});

test('start keeps an explicit workflow mode even when intent routes elsewhere', async () => {
  const result = await runCli([
    'start',
    '--mode',
    'before_edit',
    '--intent',
    'is it safe to commit this change',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('explicit');
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.missionControl.primaryAction.command).toBe('projscan preflight --mode before_commit --format json');
});

test('start console shows the full first-ten-minutes path and coordination hints', async () => {
  const result = await runCli(['start', '--intent', 'is it safe to commit this change', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Start: before_commit');
  expect(result.stdout).toContain('Mode: inferred from intent');
  expect(result.stdout).toContain('Workflow: Pre-Merge');
  expect(result.stdout).toContain('Mission Control');
  expect(result.stdout).toContain('is it safe to commit this change');
  expect(result.stdout).toContain('Route: Safety gate via projscan_preflight (confidence: high; matched: safe, commit)');
  expect(result.stdout).toContain('projscan preflight --mode before_commit --format json');
  expect(result.stdout).toContain('Done When');
  expect(result.stdout).toContain('- projscan preflight --mode before_commit returns proceed or only documented manual-review items.');
  expect(result.stdout).toContain('First 10 Minutes');
  expect(result.stdout).toContain('projscan privacy-check --offline');
  expect(result.stdout).toContain('projscan start --mode before_commit');
  expect(result.stdout).toContain('projscan preflight --mode before_commit --format json');
  expect(result.stdout).toContain('projscan evidence-pack --pr-comment');
  expect(result.stdout).toContain('projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json');
  expect(result.stdout).toContain('Coordination Hints');
  expect(result.stdout).toContain('projscan preflight --mode before_commit --format json');
  const nextCommands = extractNextCommands(result.stdout);
  expect(nextCommands).toEqual([...new Set(nextCommands)]);
  expect(nextCommands.filter((command) => command === 'projscan preflight --mode before_commit --format json')).toHaveLength(1);
});

test('start console renders a concrete action plan for fuzzy impact intents', async () => {
  const result = await runCli(['start', '--intent', 'what breaks if I rename the auth token loader', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Action Plan');
  expect(result.stdout).toContain('Execution Plan');
  expect(result.stdout).toContain('- [ready] Next Action');
  expect(result.stdout).toContain('  - Find exact target for impact analysis: projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('Run Cursor');
  expect(result.stdout).toContain('next: ready-1 in Ready Commands');
  expect(result.stdout).toContain('command: projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('MCP call: projscan_search {"query":"auth token loader"}');
  expect(result.stdout).toContain('unlocks: input-1, input-2');
  expect(result.stdout).toContain('Resume Checklist');
  expect(result.stdout.indexOf('Run Cursor')).toBeLessThan(result.stdout.indexOf('Resume Checklist'));
  expect(result.stdout.indexOf('Resume Checklist')).toBeLessThan(result.stdout.indexOf('Action Plan'));
  expect(result.stdout).toContain('- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})');
  expect(result.stdout).toContain('- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.stdout).toContain('- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})');
  expect(result.stdout).toContain('- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})');
  expect(result.stdout).toContain('Handoff Prompt');
  expect(result.stdout.indexOf('Resume Checklist')).toBeLessThan(result.stdout.indexOf('Handoff Prompt'));
  expect(result.stdout.indexOf('Handoff Prompt')).toBeLessThan(result.stdout.indexOf('Action Plan'));
  expect(result.stdout).toContain('Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).');
  expect(result.stdout).toContain('Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.');
  expect(result.stdout).toContain('- [blocked] Resolve Inputs');
  expect(result.stdout).toContain('  - symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.stdout).toContain('- [pending] Follow Up');
  expect(result.stdout).toContain('  - If search returns an exported symbol: projscan impact --symbol <symbol-from-search> --format json');
  expect(result.stdout).toContain('    blocked by: input-1');
  expect(result.stdout).toContain('- [ready] Proof');
  expect(result.stdout).toContain('  - projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('- [pending] Done When');
  expect(result.stdout).toContain('Proceed carefully: Find exact target for impact analysis');
  expect(result.stdout).toContain('- Find exact target for impact analysis: projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('- If search returns an exported symbol: projscan impact --symbol <symbol-from-search> --format json');
  expect(result.stdout).toContain('- If search returns a file path: projscan impact <file-from-search> --format json');
  expect(result.stdout).toContain('Ready Now');
  const readyCommands = extractReadyCommands(result.stdout);
  expect(readyCommands).toEqual(['projscan search "auth token loader" --format json']);
  expect(result.stdout).toContain('Needs Input');
  expect(result.stdout).toContain('- symbol: replace <symbol-from-search> after Find exact target for impact analysis');
  expect(result.stdout).toContain('- file: replace <file-from-search> after Find exact target for impact analysis');
  expect(result.stdout).toContain('Done When');
  expect(result.stdout).toContain('- An exact symbol or file path is selected from search results before impact analysis continues.');
  expect(result.stdout).toContain('Ready Proof');
  expect(result.stdout).toContain('Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.');
  const proofCommands = extractProofCommands(result.stdout);
  expect(proofCommands.some((command) => command.includes('<'))).toBe(false);
  expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');
  expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(result.stdout).toContain('Proof Queue');
  expect(result.stdout).toContain('- proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})');
  expect(result.stdout).toContain('- proof-4: projscan preflight --format json (MCP: projscan_preflight {})');
  expect(result.stdout).not.toContain('projscan impact --symbol buildCodeGraph --format json');
  expect(result.stdout).not.toContain('Agent Runbook');
});

test('start console renders a compact agent runbook when handoff is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--include-handoff',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Agent Runbook');
  expect(result.stdout).toContain('# Mission Runbook');
  expect(result.stdout).toContain('Intent: what breaks if I rename the auth token loader');
  expect(result.stdout).toContain('Current phase: ready_now');
  expect(result.stdout).toContain('## Current Cursor');
  expect(result.stdout).toContain('- Step: ready-1 in ready_now');
  expect(result.stdout).toContain('- Command: `projscan search "auth token loader" --format json`');
  expect(result.stdout).toContain('- MCP call: projscan_search {"query":"auth token loader"}');
  expect(result.stdout).toContain('- Unlocks: input-1, input-2');
  expect(result.stdout).toContain('## Resume');
  expect(result.stdout).toContain('Run now:');
  expect(result.stdout).toContain('```sh\nprojscan search "auth token loader" --format json\n```');
  expect(result.stdout).toContain('MCP call: projscan_search {"query":"auth token loader"}');
  expect(result.stdout).toContain('After running, resolve:');
  expect(result.stdout).toContain('- input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.stdout).toContain('- input-2 (file): Replace <file-from-search> with a file path returned by the search step.');
  expect(result.stdout).toContain('Template inputs:');
  expect(result.stdout).toContain('- <symbol-from-search> -> input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.stdout).toContain('- <file-from-search> -> input-2 (file): Replace <file-from-search> with a file path returned by the search step.');
  expect(result.stdout).toContain('Resume checklist:');
  expect(result.stdout).toContain('- [ready] run_current ready-1: projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})');
  expect(result.stdout).toContain('- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.stdout).toContain('- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})');
  expect(result.stdout).toContain('- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json');
  expect(result.stdout).toContain('- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})');
  expect(result.stdout).toContain('Remaining proof:');
  expect(result.stdout).not.toContain('Remaining proof:\n- `projscan search "auth token loader" --format json`');
  expect(result.stdout).toContain('MCP proof calls:');
  expect(result.stdout).toContain('- proof-2: projscan_preflight {"mode":"before_edit"}');
  expect(result.stdout).toContain('- proof-3: projscan_understand {"view":"verify"}');
  expect(result.stdout).toContain('Then use:');
  expect(result.stdout).toContain('- follow-up-1 (If search returns an exported symbol): projscan impact --symbol <symbol-from-search> --format json');
  expect(result.stdout).toContain('- follow-up-2 (If search returns a file path): projscan impact <file-from-search> --format json');
  expect(result.stdout).toContain('Prompt: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).');
  expect(result.stdout).toContain('## Handoff Prompt');
  expect(result.stdout).toContain('Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).');
  expect(result.stdout.indexOf('## Resume')).toBeLessThan(result.stdout.indexOf('## Handoff Prompt'));
  expect(result.stdout.indexOf('## Handoff Prompt')).toBeLessThan(result.stdout.indexOf('## Ready Commands'));
  expect(result.stdout).toContain('## Ready Commands');
  expect(result.stdout).toContain('- `projscan search "auth token loader" --format json`');
  expect(result.stdout).toContain('## Blocked Inputs');
  expect(result.stdout).toContain('- symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.stdout).toContain('## Done When');
  expect(result.stdout).toContain('- An exact symbol or file path is selected from search results before impact analysis continues.');
});

test('start JSON exposes a resume-aware handoff prompt for fuzzy intents', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.handoffPrompt).toContain(report.missionControl.resume.prompt);
  expect(report.missionControl.handoffPrompt).toContain('Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).');
  expect(report.missionControl.handoffPrompt).toContain('Done when: An exact symbol or file path is selected from search results before impact analysis continues.');
  expect(report.missionControl.handoffPrompt).toContain('Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.');
  expect(report.missionControl.handoffPrompt).not.toContain('Next:');
  expect(report.missionControl.handoffPrompt).not.toContain('projscan impact --symbol <symbol-from-search> --format json');
  expect(report.missionControl.handoff.readyProof.commands).toEqual(report.missionControl.resume.remainingProofCommands);
  expect(report.missionControl.handoff.readyProof.commands).not.toContain('projscan search "auth token loader" --format json');
  expect(report.missionControl.handoff.readyProof.toolCalls).toEqual(report.missionControl.resume.remainingProofToolCalls);
  expect(report.missionControl.handoff.readyProof.toolCalls?.map((call: { tool: string }) => call.tool)).not.toContain('projscan_search');
});

test('start prints only the concise handoff prompt when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--handoff-prompt',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const output = result.stdout.trim();
  expect(output).toContain('Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`.');
  expect(output).toContain('Done when: An exact symbol or file path is selected from search results before impact analysis continues.');
  expect(output).toContain('Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.');
  expect(output.split('\n')).toHaveLength(1);
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Agent Runbook');
  expect(result.stdout).not.toContain('Ready Proof');
});

test('start JSON keeps the full report when handoff prompt shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--handoff-prompt',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.handoffPrompt).toContain(report.missionControl.resume.prompt);
  expect(report.missionControl.runbook.markdown).toContain('## Handoff Prompt');
});

test('start prints only the current cursor command when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--next-command',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('projscan search "auth token loader" --format json\n');
  expect(result.stderr).toBe('');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Run Cursor');
  expect(result.stdout).not.toContain('Handoff Prompt');
});

test('start JSON keeps the full report when next-command shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--next-command',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.executionPlan.cursor.command).toBe('projscan search "auth token loader" --format json');
  expect(report.missionControl.runbook.markdown).toContain('## Current Cursor');
});

test('start prints only the current cursor MCP tool call when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--next-tool-call',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('{"tool":"projscan_search","args":{"query":"auth token loader"}}\n');
  expect(result.stderr).toBe('');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Run Cursor');
  expect(result.stdout).not.toContain('Handoff Prompt');
});

test('start JSON keeps the full report when next-tool-call shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--next-tool-call',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(report.missionControl.executionPlan.cursor.tool).toBe('projscan_search');
});

test('start prints every ready MCP tool call when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--ready-tool-calls',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  const calls = JSON.parse(result.stdout);
  expect(calls[0]).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(calls).toContainEqual({
    tool: 'projscan_preflight',
    args: { mode: 'before_edit' },
  });
  expect(calls).toContainEqual({
    tool: 'projscan_understand',
    args: { view: 'verify' },
  });
  expect(calls.some((call: Record<string, unknown>) => 'stepId' in call || 'command' in call)).toBe(false);
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
});

test('start JSON keeps the full report when ready tool calls are requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--ready-tool-calls',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(report.missionControl.handoff.readyProof.toolCalls).toEqual(report.missionControl.resume.remainingProofToolCalls);
});

test('start prints only ready proof commands when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--proof-commands',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const proofCommands = result.stdout.trim().split('\n');
  expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(proofCommands).toContain('projscan understand --view verify --format json');
  expect(proofCommands).toContain('projscan preflight --format json');
  expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Ready Proof');
  expect(result.stdout).not.toContain('Proof Queue');
});

test('start JSON keeps the full report when proof-commands shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--proof-commands',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.handoff.readyProof.commands).toEqual(report.missionControl.resume.remainingProofCommands);
  expect(report.missionControl.handoff.readyProof.commands).not.toContain('projscan search "auth token loader" --format json');
});

test('start prints only the resume checklist when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--checklist',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const checklistRows = result.stdout.trim().split('\n');
  expect(checklistRows[0]).toBe('- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})');
  expect(checklistRows).toContain('- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(checklistRows).toContain('- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})');
  expect(checklistRows).toContain('- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Resume Checklist');
  expect(result.stdout).not.toContain('Handoff Prompt');
});

test('start JSON keeps the full report when checklist shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--checklist',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.resume.checklist).toEqual(report.missionControl.handoff.resume.checklist);
  expect(report.missionControl.resume.checklist[0].command).toBe('projscan search "auth token loader" --format json');
});

test('start prints only the resume object as compact JSON when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--resume-json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  const resume = JSON.parse(result.stdout);
  expect(resume.currentStep.stepId).toBe('ready-1');
  expect(resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(resume.inputBindings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        placeholder: '<symbol-from-search>',
        inputId: 'input-1',
      }),
    ]),
  );
  expect(resume.checklist[0].kind).toBe('run_current');
  expect(resume.remainingProofToolCalls).toContainEqual({
    stepId: 'proof-2',
    command: 'projscan preflight --mode before_edit --format json',
    tool: 'projscan_preflight',
    args: { mode: 'before_edit' },
  });
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Resume Checklist');
});

test('start JSON keeps the full report when resume-json shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--resume-json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.resume.currentStep.stepId).toBe('ready-1');
  expect(report.missionControl.runbook.resume).toEqual(report.missionControl.resume);
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
  expect(result.stdout).toContain('## Ready Commands');
  expect(result.stdout).toContain('## Proof Commands');
  expect(result.stdout).toContain('Resume checklist:');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Agent Runbook');
  expect(result.stdout).not.toContain('First 10 Minutes');
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
});

test('start prints a shortcut index for the current mission when requested', async () => {
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
  expect(result.stdout).toContain('{"tool":"projscan_search","args":{"query":"auth token loader"}}');
  expect(result.stdout).toContain("projscan start --next-command --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --next-tool-call --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --ready-tool-calls --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --proof-commands --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --checklist --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --resume-json --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --runbook --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --handoff-prompt --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Run Cursor');
  expect(result.stdout).not.toContain('Ready Proof');
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
  expect(report.missionControl.executionPlan.cursor.command).toBe('projscan search "auth token loader" --format json');
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

test('start JSON exposes complete remaining proof items for handoff intents', async () => {
  const { session } = await loadSession(tmp);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(tmp, session);

  const result = await runCli([
    'start',
    '--intent',
    'give the next agent a handoff',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.resume.remainingProofCommands).toContain('projscan handoff');
  expect(report.missionControl.resume.remainingProofToolCalls.map((call: { command: string }) => call.command)).not.toContain('projscan handoff');
  expect(report.missionControl.resume.remainingProofItems.map((item: { command: string }) => item.command)).toEqual(
    report.missionControl.resume.remainingProofCommands,
  );
  expect(report.missionControl.resume.remainingProofItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        stepId: 'proof-2',
        command: 'projscan preflight --mode before_edit --format json',
        toolCall: {
          tool: 'projscan_preflight',
          args: { mode: 'before_edit' },
        },
      }),
      expect.objectContaining({
        stepId: 'proof-6',
        command: 'projscan handoff',
      }),
    ]),
  );
  expect(report.missionControl.resume.remainingProofItems.find((item: { command: string }) => item.command === 'projscan handoff').toolCall).toBeUndefined();
  expect(report.missionControl.handoff.readyProof.items).toEqual(report.missionControl.resume.remainingProofItems);
  expect(report.missionControl.handoff.readyProof.toolCalls.map((call: { command: string }) => call.command)).not.toContain('projscan handoff');
});

test('start console runbook renders a complete proof queue for handoff intents', async () => {
  const { session } = await loadSession(tmp);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(tmp, session);

  const result = await runCli([
    'start',
    '--intent',
    'give the next agent a handoff',
    '--include-handoff',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Agent Runbook');
  expect(result.stdout).toContain('Proof queue:');
  expect(result.stdout).toContain('- [ready] run_proof proof-6: projscan handoff (CLI only)');
  expect(result.stdout).toContain('- proof-2: `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})');
  expect(result.stdout).toContain('- proof-6: `projscan handoff` (CLI only)');
});

test('start console renders a proof queue for handoff intents without the runbook', async () => {
  const { session } = await loadSession(tmp);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(tmp, session);

  const result = await runCli([
    'start',
    '--intent',
    'give the next agent a handoff',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Ready Proof');
  expect(result.stdout).toContain('Resume Checklist');
  expect(result.stdout).toContain('- [ready] run_proof proof-6: projscan handoff (CLI only)');
  expect(result.stdout).toContain('Proof Queue');
  expect(result.stdout).toContain('- proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})');
  expect(result.stdout).toContain('- proof-6: projscan handoff (CLI only)');
  expect(result.stdout).not.toContain('Agent Runbook');
});

test('start console runs impact directly for file path intents', async () => {
  const result = await runCli(['start', '--intent', 'what breaks if I change src/core/start.ts', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Action Plan');
  expect(result.stdout).toContain('projscan impact src/core/start.ts --format json');
  expect(result.stdout).not.toContain('projscan search "src/core/start.ts" --format json');
});

test('start console shows alternative routes for mixed intents', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'is it safe to commit and what breaks if I rename the auth token loader',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Start: before_commit');
  expect(result.stdout).toContain('Mode: inferred from intent');
  expect(result.stdout).toContain('Also Consider');
  expect(result.stdout).toContain('- Safety gate: projscan preflight (confidence: high; matched: safe, commit)');
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

function extractNextCommands(stdout: string): string[] {
  const match = stdout.match(/Next Commands\n(?<body>[\s\S]*?)\n\nTop Risks/);
  const body = match?.groups?.body ?? '';
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
}

function extractProofCommands(stdout: string): string[] {
  const match = stdout.match(/Ready Proof\n(?<body>[\s\S]*?)\n\nFirst 10 Minutes/);
  const body = match?.groups?.body ?? '';
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
}

function extractReadyCommands(stdout: string): string[] {
  const match = stdout.match(/Ready Now\n(?<body>[\s\S]*?)\nNeeds Input/);
  const body = match?.groups?.body ?? '';
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^- [^:]+: /, ''));
}
