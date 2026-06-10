import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadMissionOutcome } from '../../src/core/missionOutcome.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('mission outcome reads proof summary and recommends review for a passed bundle', async () => {
  const root = await makeTempProject();
  await writeMissionBundle(root, {
    status: 'passed',
    totalCommands: 3,
    statusRows: [
      { id: 'current-ready-1', label: 'Run current command', log: 'current-ready-1.log', command: 'projscan search "auth" --format json', exitCode: 0 },
      { id: 'proof-1', label: 'Proof 1', log: 'proof-1.log', command: 'projscan preflight --mode before_edit --format json', exitCode: 0 },
      { id: 'proof-2', label: 'Proof 2', log: 'proof-2.log', command: 'projscan understand --view verify --format json', exitCode: 0 },
    ],
  });

  const outcome = await loadMissionOutcome(root, '.projscan/mission');

  expect(outcome.available).toBe(true);
  expect(outcome.status).toBe('passed');
  expect(outcome.proof.completedCommands).toBe(3);
  expect(outcome.proof.failedCommands).toBe(0);
  expect(outcome.whatChanged).toContain('Mission proof passed after 3 command(s).');
  expect(outcome.whatRemains).toContain('Run ./review.sh and choose a reviewer reply.');
  expect(outcome.versionCandidate.recommendation).toBe('review_candidate');
  expect(outcome.versionCandidate.summary).toContain('proof passed');
  expect(outcome.resumePrompt).toContain('Mission proof passed');
});

test('mission outcome names failed proof and blocks a version candidate', async () => {
  const root = await makeTempProject();
  await writeMissionBundle(root, {
    status: 'failed',
    failedStep: 'proof-1',
    exitCode: 1,
    log: 'proof-logs/proof-1.log',
    statusRows: [
      { id: 'current-ready-1', label: 'Run current command', log: 'current-ready-1.log', command: 'projscan search "auth" --format json', exitCode: 0 },
      { id: 'proof-1', label: 'Proof 1', log: 'proof-1.log', command: 'projscan preflight --mode before_edit --format json', exitCode: 1 },
    ],
  });

  const outcome = await loadMissionOutcome(root, '.projscan/mission');

  expect(outcome.status).toBe('failed');
  expect(outcome.proof.completedCommands).toBe(2);
  expect(outcome.proof.failedCommands).toBe(1);
  expect(outcome.proof.failedStep).toBe('proof-1');
  expect(outcome.whatRemains).toContain('Inspect proof-logs/proof-1.log, fix the failure, then rerun ./mission.sh.');
  expect(outcome.versionCandidate.recommendation).toBe('do_not_cut');
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mission-outcome-'));
  tempRoots.push(root);
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  return root;
}

async function writeMissionBundle(
  root: string,
  options: {
    status: 'not_run' | 'running' | 'passed' | 'failed';
    totalCommands?: number;
    failedStep?: string;
    exitCode?: number;
    log?: string;
    statusRows?: Array<{ id: string; label: string; log: string; command: string; exitCode: number }>;
  },
): Promise<void> {
  const missionDir = path.join(root, '.projscan', 'mission');
  const proofLogs = path.join(missionDir, 'proof-logs');
  await fs.mkdir(proofLogs, { recursive: true });
  await fs.writeFile(
    path.join(missionDir, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      kind: 'projscan.mission-bundle',
      mode: 'before_edit',
      status: 'ready',
      currentStep: { phaseId: 'ready_now', stepId: 'ready-1', command: 'projscan search "auth" --format json' },
    }) + '\n',
  );
  await fs.writeFile(
    path.join(missionDir, 'review-gate.json'),
    JSON.stringify({
      title: 'Mission Review Gate',
      decisions: [
        { id: 'approve_next_slice', label: 'Approve next slice', reply: 'Approved: start one more bounded implementation slice.' },
        { id: 'review_version_candidate', label: 'Review version candidate', reply: 'Prepare a version-candidate review only.' },
      ],
      policy: { approvalRequired: true, blockedActions: ['release', 'publish', 'version_bump'] },
    }) + '\n',
  );
  await fs.writeFile(path.join(missionDir, 'proof-commands.txt'), 'projscan preflight --mode before_edit --format json\n');
  await fs.writeFile(
    path.join(proofLogs, 'summary.json'),
    JSON.stringify({
      schemaVersion: 1,
      status: options.status,
      nextAction: options.status === 'passed' ? 'run ./review.sh and choose a reviewer reply.' : 'inspect the failed log, fix the issue, then rerun ./mission.sh.',
      report: 'proof-logs/run-report.md',
      statusRows: 'proof-logs/status.jsonl',
      ...(typeof options.totalCommands === 'number' ? { totalCommands: options.totalCommands } : {}),
      ...(options.failedStep ? { failedStep: options.failedStep } : {}),
      ...(typeof options.exitCode === 'number' ? { exitCode: options.exitCode } : {}),
      ...(options.log ? { log: options.log } : {}),
    }) + '\n',
  );
  await fs.writeFile(
    path.join(proofLogs, 'status.jsonl'),
    (options.statusRows ?? []).map((row) => JSON.stringify(row)).join('\n') + '\n',
  );
  await fs.writeFile(path.join(proofLogs, 'run-report.md'), '# Mission Run Report\n\n## Result\n');
}
