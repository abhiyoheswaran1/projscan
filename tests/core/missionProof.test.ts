import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeMissionProofReport } from '../../src/core/missionProof.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('mission proof compares mission control bundles against manual baseline evidence', async () => {
  const root = await makeTempProject();
  await writeBundle(root, '.projscan/mission-a', {
    status: 'passed',
    rows: [
      { id: 'current-ready-1', exitCode: 0 },
      { id: 'proof-1', exitCode: 0 },
    ],
    decisions: [{ decision: 'review_version_candidate', reviewer: 'abhi' }],
  });
  await writeBundle(root, '.projscan/mission-b', {
    status: 'failed',
    failedStep: 'proof-1',
    rows: [
      { id: 'current-ready-1', exitCode: 0 },
      { id: 'proof-1', exitCode: 1 },
      { id: 'proof-1', exitCode: 0 },
    ],
    decisions: [{ decision: 'request_changes', reviewer: 'reviewer' }],
  });
  const baselinePath = path.join(root, 'manual-runs.json');
  await fs.writeFile(
    baselinePath,
    JSON.stringify({
      schemaVersion: 1,
      runs: [
        { id: 'manual-1', status: 'failed', failedGates: 2, reruns: 3, minutesSpent: 45 },
        { id: 'manual-2', status: 'passed', failedGates: 0, reruns: 1, minutesSpent: 25 },
      ],
    }) + '\n',
  );

  const report = await computeMissionProofReport(root, {
    missions: ['.projscan/mission-a', '.projscan/mission-b'],
    baselineFile: baselinePath,
  });

  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.summary).toContain('2 mission bundle(s)');
  expect(report.missionControl.totals.passed).toBe(1);
  expect(report.missionControl.totals.failed).toBe(1);
  expect(report.missionControl.totals.reruns).toBe(1);
  expect(report.missionControl.totals.failedGates).toBe(1);
  expect(report.missionControl.totals.reviewerApprovals).toBe(1);
  expect(report.baseline?.totals.reruns).toBe(4);
  expect(report.comparison?.rerunsAvoided).toBe(3);
  expect(report.comparison?.failedGatesAvoided).toBe(1);
  expect(report.comparison?.minutesSaved).toBe(70);
  expect(report.riskAvoided).toContain(
    '1 failed mission gate(s) stopped before release or publish.',
  );
  expect(report.nextActions.map((action) => action.command)).toContain(
    'projscan start --mission .projscan/mission-a',
  );
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mission-proof-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  return root;
}

async function writeBundle(
  root: string,
  relativeDir: string,
  options: {
    status: 'passed' | 'failed';
    failedStep?: string;
    rows: Array<{ id: string; exitCode: number }>;
    decisions: Array<{
      decision: 'approve_next_slice' | 'request_changes' | 'review_version_candidate';
      reviewer: string;
    }>;
  },
): Promise<void> {
  const dir = path.join(root, relativeDir);
  const proof = path.join(dir, 'proof-logs');
  await fs.mkdir(proof, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      kind: 'projscan.mission-bundle',
      mode: 'before_edit',
      status: 'ready',
      currentStep: {
        phaseId: 'ready_now',
        stepId: 'ready-1',
        command: 'projscan search "auth" --format json',
      },
    }) + '\n',
  );
  await fs.writeFile(
    path.join(proof, 'summary.json'),
    JSON.stringify({
      schemaVersion: 1,
      status: options.status,
      ...(options.failedStep
        ? { failedStep: options.failedStep, log: 'proof-logs/proof-1.log', exitCode: 1 }
        : {}),
    }) + '\n',
  );
  await fs.writeFile(
    path.join(proof, 'status.jsonl'),
    options.rows
      .map((row) =>
        JSON.stringify({
          id: row.id,
          label: row.id,
          log: `${row.id}.log`,
          command: 'projscan preflight --format json',
          exitCode: row.exitCode,
        }),
      )
      .join('\n') + '\n',
  );
  await fs.writeFile(
    path.join(proof, 'review-decisions.jsonl'),
    options.decisions
      .map((decision) => JSON.stringify({ ...decision, at: '2026-06-10T10:00:00.000Z' }))
      .join('\n') + '\n',
  );
}
