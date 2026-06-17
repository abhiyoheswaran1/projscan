import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
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
  expect(
    report.missionControl.resume.remainingProofToolCalls.map(
      (call: { command: string }) => call.command,
    ),
  ).not.toContain('projscan handoff');
  expect(
    report.missionControl.resume.remainingProofItems.map(
      (item: { command: string }) => item.command,
    ),
  ).toEqual(report.missionControl.resume.remainingProofCommands);
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
  expect(
    report.missionControl.resume.remainingProofItems.find(
      (item: { command: string }) => item.command === 'projscan handoff',
    ).toolCall,
  ).toBeUndefined();
  expect(report.missionControl.handoff.readyProof.items).toEqual(
    report.missionControl.resume.remainingProofItems,
  );
  expect(
    report.missionControl.handoff.readyProof.toolCalls.map(
      (call: { command: string }) => call.command,
    ),
  ).not.toContain('projscan handoff');
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
  expect(result.stdout).toContain(
    '- proof-2: `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.stdout).toContain('- proof-6: `projscan handoff` (CLI only)');
});

test('start console renders a proof queue for handoff intents without the runbook', async () => {
  const { session } = await loadSession(tmp);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(tmp, session);

  const result = await runCli(['start', '--intent', 'give the next agent a handoff', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Ready Proof');
  expect(result.stdout).toContain('Resume Checklist');
  expect(result.stdout).toContain('- [ready] run_proof proof-6: projscan handoff (CLI only)');
  expect(result.stdout).toContain('Proof Queue');
  expect(result.stdout).toContain(
    '- proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.stdout).toContain('- proof-6: projscan handoff (CLI only)');
  expect(result.stdout).not.toContain('Agent Runbook');
});


async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
