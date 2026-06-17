import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { expectedReviewPromptReplies } from '../helpers/startReviewGate.js';
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
  expect(output).toContain(
    'Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`.',
  );
  expect(output).toContain(
    'Done when: An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(output).toContain(
    'Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
  );
  expect(output).toContain(
    'Review gate: Stop after the current Mission Control checklist and proof are complete.',
  );
  expect(output).toContain(expectedReviewPromptReplies[0]);
  expect(output.split('\n')).toHaveLength(1);
  expect(result.stdout).not.toContain('Start:');
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
  expect(report.missionControl.executionPlan.cursor.command).toBe(
    'projscan search "auth token loader" --format json',
  );
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
  expect(calls.some((call: Record<string, unknown>) => 'stepId' in call || 'command' in call)).toBe(
    false,
  );
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
  expect(report.missionControl.handoff.readyProof.toolCalls).toEqual(
    report.missionControl.resume.remainingProofToolCalls,
  );
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
  expect(report.missionControl.handoff.readyProof.commands).toEqual(
    report.missionControl.resume.remainingProofCommands,
  );
  expect(report.missionControl.handoff.readyProof.commands).not.toContain(
    'projscan search "auth token loader" --format json',
  );
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
  expect(checklistRows[0]).toBe(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})',
  );
  expect(checklistRows).toContain(
    '- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(checklistRows).toContain(
    '- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})',
  );
  expect(checklistRows).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
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
  expect(report.missionControl.resume.checklist).toEqual(
    report.missionControl.handoff.resume.checklist,
  );
  expect(report.missionControl.resume.checklist[0].command).toBe(
    'projscan search "auth token loader" --format json',
  );
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

test('start prints only the handoff object as compact JSON when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--handoff-json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  const handoff = JSON.parse(result.stdout);
  expect(handoff.currentStep.stepId).toBe('ready-1');
  expect(handoff.resume.currentStep.stepId).toBe('ready-1');
  expect(handoff.resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(handoff.readyProof.commands).toEqual(handoff.resume.remainingProofCommands);
  expect(handoff.readyProof.toolCalls).toEqual(handoff.resume.remainingProofToolCalls);
  expect(handoff.reviewGate).toEqual(
    expect.objectContaining({
      title: 'Mission Review Gate',
      commands: ['git status --short', 'git diff --stat'],
    }),
  );
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('\nMission Control\n');
  expect(result.stdout).not.toContain('Handoff Prompt');
});

test('start JSON keeps the full report when handoff-json shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--handoff-json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.handoff.currentStep.stepId).toBe('ready-1');
  expect(report.missionControl.handoff.resume).toEqual(report.missionControl.resume);
});


async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
