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
  expect(result.stdout).toContain('unlocks: input-1, input-2');
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
  expect(proofCommands).toContain('projscan search "auth token loader" --format json');
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
  expect(result.stdout).toContain('## Current Cursor');
  expect(result.stdout).toContain('- Step: ready-1 in ready_now');
  expect(result.stdout).toContain('- Command: `projscan search "auth token loader" --format json`');
  expect(result.stdout).toContain('- Unlocks: input-1, input-2');
  expect(result.stdout).toContain('## Ready Commands');
  expect(result.stdout).toContain('- `projscan search "auth token loader" --format json`');
  expect(result.stdout).toContain('## Blocked Inputs');
  expect(result.stdout).toContain('- symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.stdout).toContain('## Done When');
  expect(result.stdout).toContain('- An exact symbol or file path is selected from search results before impact analysis continues.');
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
