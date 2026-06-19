import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { extractProofCommands, extractReadyCommands, runStartCli } from '../helpers/startCli.js';
import {
  expectedReviewReplyLines,
  expectedReviewPromptReplies,
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

test('start console renders a concrete action plan for fuzzy impact intents', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Action Plan');
  expect(result.stdout).toContain('Execution Plan');
  expect(result.stdout).not.toContain('- [ready] Next Action');
  expect(result.stdout).toContain('- [ready] Ready Commands');
  expect(result.stdout).toContain(
    '  - Find exact target for impact analysis: projscan search "auth token loader" --format json',
  );
  expect(result.stdout).toContain('Run Cursor');
  expect(result.stdout).toContain('next: ready-1 in Ready Commands');
  expect(result.stdout).toContain('command: projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('MCP call: projscan_search {"query":"auth token loader"}');
  expect(result.stdout).toContain('unlocks: input-1, input-2');
  expect(result.stdout).toContain('Resume Checklist');
  expect(result.stdout.indexOf('Run Cursor')).toBeLessThan(
    result.stdout.indexOf('Resume Checklist'),
  );
  expect(result.stdout.indexOf('Resume Checklist')).toBeLessThan(
    result.stdout.indexOf('Action Plan'),
  );
  expect(result.stdout).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})',
  );
  expect(result.stdout).toContain(
    '- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(result.stdout).toContain(
    '- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})',
  );
  expect(result.stdout).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.stdout).toContain('Handoff Prompt');
  expect(result.stdout.indexOf('Resume Checklist')).toBeLessThan(
    result.stdout.indexOf('Handoff Prompt'),
  );
  expect(result.stdout.indexOf('Handoff Prompt')).toBeLessThan(
    result.stdout.indexOf('Review Gate'),
  );
  expect(result.stdout.indexOf('Review Gate')).toBeLessThan(result.stdout.indexOf('Action Plan'));
  expect(result.stdout).toContain(
    'Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
  );
  expect(result.stdout).toContain(
    'Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
  );
  expect(result.stdout).toContain('Review Gate');
  expect(result.stdout).toContain(
    'Stop after the current Mission Control checklist and proof are complete.',
  );
  expect(result.stdout).toContain('- git status --short');
  expect(result.stdout).toContain('- git diff --stat');
  expect(result.stdout).toContain('Current worktree evidence');
  expect(result.stdout).toContain('Reviewer Replies');
  for (const replyLine of expectedReviewReplyLines) {
    expect(result.stdout).toContain(replyLine);
  }
  expect(result.stdout.indexOf('Reviewer Replies')).toBeLessThan(
    result.stdout.indexOf('Action Plan'),
  );
  expect(result.stdout).toContain(
    'Stop and ask for approval before starting another slice, release, publish, or deploy.',
  );
  expect(result.stdout).toContain('- [blocked] Resolve Inputs');
  expect(result.stdout).toContain(
    '  - symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(result.stdout).toContain('- [pending] Follow Up');
  expect(result.stdout).toContain(
    '  - If search returns an exported symbol: projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(result.stdout).toContain('    blocked by: input-1');
  expect(result.stdout).toContain('- [ready] Proof');
  expect(result.stdout).toContain('  - projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('- [pending] Done When');
  expect(result.stdout).toContain('Proceed carefully: Find exact target for impact analysis');
  expect(result.stdout).toContain(
    '- Find exact target for impact analysis: projscan search "auth token loader" --format json',
  );
  expect(result.stdout).toContain(
    '- If search returns an exported symbol: projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(result.stdout).toContain(
    '- If search returns a file path: projscan impact <file-from-search> --format json',
  );
  expect(result.stdout).toContain('Ready Now');
  const readyCommands = extractReadyCommands(result.stdout);
  expect(readyCommands).toEqual(['projscan search "auth token loader" --format json']);
  expect(result.stdout).toContain('Needs Input');
  expect(result.stdout).toContain(
    '- symbol: replace <symbol-from-search> after Find exact target for impact analysis',
  );
  expect(result.stdout).toContain(
    '- file: replace <file-from-search> after Find exact target for impact analysis',
  );
  expect(result.stdout).toContain('Done When');
  expect(result.stdout).toContain(
    '- An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(result.stdout).toContain('Ready Proof');
  expect(result.stdout).toContain(
    'Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
  );
  const proofCommands = extractProofCommands(result.stdout);
  expect(proofCommands.some((command) => command.includes('<'))).toBe(false);
  expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');
  expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(result.stdout).toContain('Proof Queue');
  expect(result.stdout).toContain(
    '- proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.stdout).not.toContain('projscan preflight --format json');
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
  expect(result.stdout).toContain(
    '- input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(result.stdout).toContain(
    '- input-2 (file): Replace <file-from-search> with a file path returned by the search step.',
  );
  expect(result.stdout).toContain('Template inputs:');
  expect(result.stdout).toContain(
    '- <symbol-from-search> -> input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(result.stdout).toContain(
    '- <file-from-search> -> input-2 (file): Replace <file-from-search> with a file path returned by the search step.',
  );
  expect(result.stdout).toContain('Resume checklist:');
  expect(result.stdout).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json',
  );
  expect(result.stdout).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})',
  );
  expect(result.stdout).toContain(
    '- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(result.stdout).toContain(
    '- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})',
  );
  expect(result.stdout).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json',
  );
  expect(result.stdout).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.stdout).toContain('Remaining proof:');
  expect(result.stdout).not.toContain(
    'Remaining proof:\n- `projscan search "auth token loader" --format json`',
  );
  expect(result.stdout).toContain('MCP proof calls:');
  expect(result.stdout).toContain('- proof-2: projscan_preflight {"mode":"before_edit"}');
  expect(result.stdout).toContain('- proof-3: projscan_understand {"view":"verify"}');
  expect(result.stdout).toContain('Then use:');
  expect(result.stdout).toContain(
    '- follow-up-1 (If search returns an exported symbol): projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(result.stdout).toContain(
    '- follow-up-2 (If search returns a file path): projscan impact <file-from-search> --format json',
  );
  expect(result.stdout).toContain(
    'Prompt: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
  );
  expect(result.stdout).toContain('## Handoff Prompt');
  expect(result.stdout).toContain(
    'Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
  );
  expect(result.stdout.indexOf('## Resume')).toBeLessThan(
    result.stdout.indexOf('## Handoff Prompt'),
  );
  expect(result.stdout.indexOf('## Handoff Prompt')).toBeLessThan(
    result.stdout.indexOf('## Ready Commands'),
  );
  expect(result.stdout).toContain('## Ready Commands');
  expect(result.stdout).toContain('- `projscan search "auth token loader" --format json`');
  expect(result.stdout).toContain('## Blocked Inputs');
  expect(result.stdout).toContain(
    '- symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(result.stdout).toContain('## Done When');
  expect(result.stdout).toContain(
    '- An exact symbol or file path is selected from search results before impact analysis continues.',
  );
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
  expect(report.missionControl.handoffPrompt).toContain(
    'Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'Done when: An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'Review gate: Stop after the current Mission Control checklist and proof are complete.',
  );
  expect(report.missionControl.handoffPrompt).toContain(expectedReviewPromptReplies[0]);
  expect(report.missionControl.handoffPrompt).not.toContain('Next:');
  expect(report.missionControl.handoffPrompt).not.toContain(
    'projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(report.missionControl.handoff.readyProof.commands).toEqual(
    report.missionControl.resume.remainingProofCommands,
  );
  expect(report.missionControl.handoff.readyProof.commands).not.toContain(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.handoff.readyProof.toolCalls).toEqual(
    report.missionControl.resume.remainingProofToolCalls,
  );
  expect(
    report.missionControl.handoff.readyProof.toolCalls?.map((call: { tool: string }) => call.tool),
  ).not.toContain('projscan_search');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
