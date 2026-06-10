import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-mission-proof-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await writeMission(tmp, '.projscan/mission', 'passed');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('mission-proof reports local Mission Control adoption evidence as JSON', async () => {
  const result = await runCli(['mission-proof', '--mission', '.projscan/mission', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.missionControl.totals.missions).toBe(1);
  expect(report.missionControl.totals.passed).toBe(1);
  expect(report.nextActions.map((action: { command?: string }) => action.command)).toContain('projscan start --mission .projscan/mission');
});

test('mission-proof prints a paste-ready Markdown evidence report', async () => {
  await fs.writeFile(
    path.join(tmp, 'manual-runs.json'),
    JSON.stringify({
      schemaVersion: 1,
      runs: [
        {
          id: 'manual-1',
          status: 'passed',
          failedGates: 1,
          reruns: 2,
          minutesSpent: 30,
          reviewerApprovals: 0,
        },
      ],
    }) + '\n',
  );

  const result = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--baseline',
    'manual-runs.json',
    '--format',
    'markdown',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('# Mission Proof Report');
  expect(result.stdout).toContain('## Summary');
  expect(result.stdout).toContain('- Mission bundles: 1');
  expect(result.stdout).toContain('- Passed: 1');
  expect(result.stdout).toContain('- Proof completion: 100%');
  expect(result.stdout).toContain('## Mission Outcomes');
  expect(result.stdout).toContain('### .projscan/mission');
  expect(result.stdout).toContain('- Status: passed');
  expect(result.stdout).toContain('- Commands: 2 completed, 0 failed, 0 reruns');
  expect(result.stdout).toContain('- Version candidate: review_candidate');
  expect(result.stdout).toContain('- Changed: Mission proof passed after 2 command(s).');
  expect(result.stdout).toContain('- Remains: Run ./review.sh and choose a reviewer reply.');
  expect(result.stdout).toContain('## Baseline Comparison');
  expect(result.stdout).toContain('- Baseline: manual-runs.json');
  expect(result.stdout).toContain('- Reruns avoided: 2');
  expect(result.stdout).toContain('- Failed gates avoided: 1');
  expect(result.stdout).toContain('- Minutes saved: 30');
  expect(result.stdout).toContain('## Risk Avoided');
  expect(result.stdout).toContain('1 failed gate(s) avoided versus the manual baseline.');
  expect(result.stdout).toContain('## Next Actions');
  expect(result.stdout).toContain('```bash\nprojscan start --mission .projscan/mission\n```');
  expect(result.stdout).not.toContain('{');
});

test('mission-proof writes Markdown and JSON reports as local artifacts', async () => {
  const markdown = path.join('artifacts', 'mission-proof.md');
  const json = path.join('artifacts', 'mission-proof.json');
  const realTmp = await fs.realpath(tmp);

  const markdownResult = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--write',
    markdown,
    '--quiet',
  ]);
  const jsonResult = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--format',
    'json',
    '--write',
    json,
    '--quiet',
  ]);

  expect(markdownResult.exitCode).toBe(0);
  expect(markdownResult.stdout).toContain(`Wrote mission proof report to ${path.join(realTmp, markdown)}`);
  expect(markdownResult.stdout).not.toContain('# Mission Proof Report');
  const markdownReport = await fs.readFile(path.join(tmp, markdown), 'utf-8');
  expect(markdownReport).toContain('# Mission Proof Report');
  expect(markdownReport).toContain('## Mission Outcomes');

  expect(jsonResult.exitCode).toBe(0);
  expect(jsonResult.stdout).toContain(`"writtenTo": "${path.join(realTmp, json)}"`);
  const jsonReport = JSON.parse(await fs.readFile(path.join(tmp, json), 'utf-8'));
  expect(jsonReport.schemaVersion).toBe(1);
  expect(jsonReport.missionControl.totals.passed).toBe(1);
});

test('mission-proof discovers saved mission bundles with --all', async () => {
  await writeMission(tmp, '.projscan/missions/api-hardening', 'passed');
  await writeMission(tmp, '.projscan/missions/ui-regression', 'failed');

  const result = await runCli(['mission-proof', '--all', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.totals.missions).toBe(3);
  expect(report.missionControl.totals.passed).toBe(2);
  expect(report.missionControl.totals.failed).toBe(1);
  expect(report.missionControl.missions.map((mission: { missionDir: string }) => mission.missionDir)).toEqual([
    '.projscan/mission',
    '.projscan/missions/api-hardening',
    '.projscan/missions/ui-regression',
  ]);
});

test('mission-proof can report the latest saved mission bundle', async () => {
  await writeMission(tmp, '.projscan/missions/api-hardening', 'passed');
  await writeMission(tmp, '.projscan/missions/ui-regression', 'failed');
  await touchSummary('.projscan/mission', new Date('2026-06-10T08:00:00.000Z'));
  await touchSummary('.projscan/missions/api-hardening', new Date('2026-06-10T09:00:00.000Z'));
  await touchSummary('.projscan/missions/ui-regression', new Date('2026-06-10T10:00:00.000Z'));

  const result = await runCli(['mission-proof', '--latest', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.totals.missions).toBe(1);
  expect(report.missionControl.totals.failed).toBe(1);
  expect(report.missionControl.missions[0].missionDir).toBe('.projscan/missions/ui-regression');
});

test('mission-proof explains when --latest has no saved mission bundles', async () => {
  await fs.rm(path.join(tmp, '.projscan'), { recursive: true, force: true });

  const result = await runCli(['mission-proof', '--latest', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('No saved mission bundles found under .projscan/mission or .projscan/missions.');
  expect(result.stderr).toContain('Create one with: projscan start --save-mission .projscan/mission --intent "<goal>"');
});

test('mission-proof can list saved mission bundles for selection', async () => {
  await writeMission(tmp, '.projscan/missions/api-hardening', 'passed');
  await writeMission(tmp, '.projscan/missions/ui-regression', 'failed');
  await touchSummary('.projscan/mission', new Date('2026-06-10T08:00:00.000Z'));
  await touchSummary('.projscan/missions/api-hardening', new Date('2026-06-10T09:00:00.000Z'));
  await touchSummary('.projscan/missions/ui-regression', new Date('2026-06-10T10:00:00.000Z'));

  const result = await runCli(['mission-proof', '--list', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout);
  expect(parsed).toEqual({
    missions: [
      {
        missionDir: '.projscan/missions/ui-regression',
        status: 'failed',
        updatedAt: '2026-06-10T10:00:00.000Z',
        resumeCommand: 'projscan start --mission .projscan/missions/ui-regression',
        proofCommand: 'projscan mission-proof --mission .projscan/missions/ui-regression --format markdown',
      },
      {
        missionDir: '.projscan/missions/api-hardening',
        status: 'passed',
        updatedAt: '2026-06-10T09:00:00.000Z',
        resumeCommand: 'projscan start --mission .projscan/missions/api-hardening',
        proofCommand: 'projscan mission-proof --mission .projscan/missions/api-hardening --format markdown',
      },
      {
        missionDir: '.projscan/mission',
        status: 'passed',
        updatedAt: '2026-06-10T08:00:00.000Z',
        resumeCommand: 'projscan start --mission .projscan/mission',
        proofCommand: 'projscan mission-proof --mission .projscan/mission --format markdown',
      },
    ],
    totals: {
      missions: 3,
      passed: 2,
      failed: 1,
      running: 0,
      notRun: 0,
      unknown: 0,
    },
  });
  expect(result.stderr).toBe('');
});

test('mission-proof list markdown includes totals and copyable commands', async () => {
  await writeMission(tmp, '.projscan/missions/api-hardening', 'passed');
  await writeMission(tmp, '.projscan/missions/ui-regression', 'failed');
  await touchSummary('.projscan/mission', new Date('2026-06-10T08:00:00.000Z'));
  await touchSummary('.projscan/missions/api-hardening', new Date('2026-06-10T09:00:00.000Z'));
  await touchSummary('.projscan/missions/ui-regression', new Date('2026-06-10T10:00:00.000Z'));

  const result = await runCli(['mission-proof', '--list', '--format', 'markdown', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('# Saved Mission Bundles');
  expect(result.stdout).toContain('- Missions: 3');
  expect(result.stdout).toContain('- Passed: 2');
  expect(result.stdout).toContain('- Failed: 1');
  expect(result.stdout).toContain('## .projscan/missions/ui-regression');
  expect(result.stdout).toContain('- Status: failed');
  expect(result.stdout).toContain('- Updated: 2026-06-10T10:00:00.000Z');
  expect(result.stdout).toContain('```bash\nprojscan start --mission .projscan/missions/ui-regression\n```');
  expect(result.stdout).toContain('```bash\nprojscan mission-proof --mission .projscan/missions/ui-regression --format markdown\n```');
});

test('mission-proof list handles empty saved mission sets', async () => {
  await fs.rm(path.join(tmp, '.projscan'), { recursive: true, force: true });

  const result = await runCli(['mission-proof', '--list', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    missions: [],
    totals: {
      missions: 0,
      passed: 0,
      failed: 0,
      running: 0,
      notRun: 0,
      unknown: 0,
    },
  });
  expect(result.stderr).toBe('');
});

test('mission-proof list can show only saved missions needing attention', async () => {
  await writeMission(tmp, '.projscan/missions/api-hardening', 'passed');
  await writeMission(tmp, '.projscan/missions/ui-regression', 'failed');
  await touchSummary('.projscan/mission', new Date('2026-06-10T08:00:00.000Z'));
  await touchSummary('.projscan/missions/api-hardening', new Date('2026-06-10T09:00:00.000Z'));
  await touchSummary('.projscan/missions/ui-regression', new Date('2026-06-10T10:00:00.000Z'));

  const result = await runCli(['mission-proof', '--list', '--needs-attention', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    missions: [
      {
        missionDir: '.projscan/missions/ui-regression',
        status: 'failed',
        updatedAt: '2026-06-10T10:00:00.000Z',
        resumeCommand: 'projscan start --mission .projscan/missions/ui-regression',
        proofCommand: 'projscan mission-proof --mission .projscan/missions/ui-regression --format markdown',
      },
    ],
    totals: {
      missions: 1,
      passed: 0,
      failed: 1,
      running: 0,
      notRun: 0,
      unknown: 0,
    },
  });
  expect(result.stderr).toBe('');
});

test('mission-proof list can filter saved missions by exact status', async () => {
  await writeMission(tmp, '.projscan/missions/api-hardening', 'passed');
  await writeMission(tmp, '.projscan/missions/ui-regression', 'failed');
  await touchSummary('.projscan/mission', new Date('2026-06-10T08:00:00.000Z'));
  await touchSummary('.projscan/missions/api-hardening', new Date('2026-06-10T09:00:00.000Z'));
  await touchSummary('.projscan/missions/ui-regression', new Date('2026-06-10T10:00:00.000Z'));

  const result = await runCli(['mission-proof', '--list', '--mission-status', 'passed', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    missions: [
      {
        missionDir: '.projscan/missions/api-hardening',
        status: 'passed',
        updatedAt: '2026-06-10T09:00:00.000Z',
        resumeCommand: 'projscan start --mission .projscan/missions/api-hardening',
        proofCommand: 'projscan mission-proof --mission .projscan/missions/api-hardening --format markdown',
      },
      {
        missionDir: '.projscan/mission',
        status: 'passed',
        updatedAt: '2026-06-10T08:00:00.000Z',
        resumeCommand: 'projscan start --mission .projscan/mission',
        proofCommand: 'projscan mission-proof --mission .projscan/mission --format markdown',
      },
    ],
    totals: {
      missions: 2,
      passed: 2,
      failed: 0,
      running: 0,
      notRun: 0,
      unknown: 0,
    },
  });
  expect(result.stderr).toBe('');
});

test('mission-proof can gate automation on all selected bundles passing', async () => {
  await writeMission(tmp, '.projscan/missions/api-hardening', 'passed');
  await writeMission(tmp, '.projscan/missions/ui-regression', 'failed');

  const failed = await runCli(['mission-proof', '--all', '--require-passed', '--format', 'json', '--quiet']);
  const passed = await runCli(['mission-proof', '--mission', '.projscan/mission', '--require-passed', '--format', 'json', '--quiet']);

  expect(failed.exitCode).toBe(1);
  const failedReport = JSON.parse(failed.stdout);
  expect(failedReport.missionControl.totals.missions).toBe(3);
  expect(failedReport.missionControl.totals.failed).toBe(1);
  expect(failed.stderr).toContain('Mission proof gate failed: 2 of 3 mission bundle(s) passed; 1 failed.');

  expect(passed.exitCode).toBe(0);
  const passedReport = JSON.parse(passed.stdout);
  expect(passedReport.missionControl.totals.passed).toBe(1);
  expect(passed.stderr).toBe('');
});

test('mission-proof can print a compact summary for CI logs', async () => {
  await writeMission(tmp, '.projscan/missions/api-hardening', 'passed');
  await writeMission(tmp, '.projscan/missions/ui-regression', 'failed');

  const summary = await runCli(['mission-proof', '--all', '--summary', '--quiet']);
  const gated = await runCli(['mission-proof', '--all', '--summary', '--require-passed', '--quiet']);
  const passed = await runCli(['mission-proof', '--mission', '.projscan/mission', '--summary', '--require-passed', '--quiet']);

  expect(summary.exitCode).toBe(0);
  expect(summary.stdout.trim()).toBe('Mission proof: FAIL (2 of 3 passed; 1 failed).');
  expect(summary.stderr).toBe('');

  expect(gated.exitCode).toBe(1);
  expect(gated.stdout.trim()).toBe('Mission proof: FAIL (2 of 3 passed; 1 failed).');
  expect(gated.stderr).toContain('Mission proof gate failed: 2 of 3 mission bundle(s) passed; 1 failed.');

  expect(passed.exitCode).toBe(0);
  expect(passed.stdout.trim()).toBe('Mission proof: PASS (1 of 1 passed).');
  expect(passed.stderr).toBe('');
});

test('mission-proof can write a local manual-baseline template', async () => {
  const target = path.join('baselines', 'manual-runs.json');
  const realTmp = await fs.realpath(tmp);

  const result = await runCli(['mission-proof', '--init-baseline', target, '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim()).toBe(`Wrote mission proof baseline template to ${path.join(realTmp, target)}`);
  expect(result.stderr).toBe('');
  const template = JSON.parse(await fs.readFile(path.join(tmp, target), 'utf-8'));
  expect(template.schemaVersion).toBe(1);
  expect(template.runs).toEqual([]);
  expect(template.exampleRun).toEqual({
    id: 'manual-before-mission-control',
    status: 'passed',
    minutesSpent: 30,
    reruns: 1,
    failedGates: 0,
    reviewerApprovals: 1,
  });
});

test('mission-proof can emit JSON when writing a local manual-baseline template', async () => {
  const target = path.join('baselines', 'manual-runs.json');
  const realTmp = await fs.realpath(tmp);

  const result = await runCli(['mission-proof', '--init-baseline', target, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toEqual({
    writtenTo: path.join(realTmp, target),
    runCount: 0,
    template: true,
  });
});

test('mission-proof explains how to create a missing baseline file', async () => {
  const result = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--baseline',
    'missing-baseline.json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Mission proof baseline file not found: missing-baseline.json');
  expect(result.stderr).toContain('Create one with: projscan mission-proof --init-baseline missing-baseline.json');
});

test('mission-proof explains malformed baseline JSON', async () => {
  await fs.writeFile(path.join(tmp, 'bad-baseline.json'), '{not-json\n');

  const result = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--baseline',
    'bad-baseline.json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Mission proof baseline file is not valid JSON: bad-baseline.json');
  expect(result.stderr).toContain('Expected shape: {"schemaVersion":1,"runs":[...]}');
});

test('mission-proof validates baseline run status values', async () => {
  await fs.writeFile(
    path.join(tmp, 'bad-status-baseline.json'),
    JSON.stringify({
      schemaVersion: 1,
      runs: [{ id: 'manual-1', status: 'passd', minutesSpent: 20 }],
    }) + '\n',
  );

  const result = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--baseline',
    'bad-status-baseline.json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain(
    'Mission proof baseline invalid at runs[0].status: expected passed, failed, running, not_run, or unknown.',
  );
});

test('mission-proof validates baseline metric fields', async () => {
  await fs.writeFile(
    path.join(tmp, 'bad-metric-baseline.json'),
    JSON.stringify({
      schemaVersion: 1,
      runs: [{ id: 'manual-1', status: 'passed', minutesSpent: 'a lot' }],
    }) + '\n',
  );

  const result = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--baseline',
    'bad-metric-baseline.json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Mission proof baseline invalid at runs[0].minutesSpent: expected a non-negative number.');
});

test('mission-proof validates baseline run ids', async () => {
  await fs.writeFile(
    path.join(tmp, 'bad-id-baseline.json'),
    JSON.stringify({
      schemaVersion: 1,
      runs: [{ status: 'passed', minutesSpent: 20 }],
    }) + '\n',
  );

  const result = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--baseline',
    'bad-id-baseline.json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Mission proof baseline invalid at runs[0].id: expected a non-empty string.');
});

test('mission-proof rejects duplicate baseline run ids', async () => {
  const target = path.join('baselines', 'duplicate-run-baseline.json');
  await fs.mkdir(path.join(tmp, 'baselines'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, target),
    JSON.stringify({
      schemaVersion: 1,
      runs: [
        { id: 'manual-1', status: 'passed', minutesSpent: 20 },
        { id: 'manual-1', status: 'failed', reruns: 1 },
      ],
    }) + '\n',
  );

  const result = await runCli(['mission-proof', '--check-baseline', target, '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Mission proof baseline invalid at runs[1].id: duplicate id manual-1.');
});

test('mission-proof can append a measured manual baseline run', async () => {
  const target = path.join('baselines', 'manual-runs.json');
  const realTmp = await fs.realpath(tmp);

  const append = await runCli([
    'mission-proof',
    '--add-baseline-run',
    target,
    '--id',
    'manual-1',
    '--status',
    'passed',
    '--minutes-spent',
    '25',
    '--reruns',
    '1',
    '--failed-gates',
    '0',
    '--reviewer-approvals',
    '1',
    '--quiet',
  ]);
  const report = await runCli([
    'mission-proof',
    '--mission',
    '.projscan/mission',
    '--baseline',
    target,
    '--format',
    'json',
    '--quiet',
  ]);

  expect(append.exitCode).toBe(0);
  expect(append.stdout.trim()).toBe(`Added baseline run manual-1 to ${path.join(realTmp, target)}`);
  expect(append.stderr).toBe('');
  const baseline = JSON.parse(await fs.readFile(path.join(tmp, target), 'utf-8'));
  expect(baseline.runs).toEqual([
    {
      id: 'manual-1',
      status: 'passed',
      minutesSpent: 25,
      reruns: 1,
      failedGates: 0,
      reviewerApprovals: 1,
    },
  ]);

  expect(report.exitCode).toBe(0);
  const parsed = JSON.parse(report.stdout);
  expect(parsed.baseline.totals.minutesSpent).toBe(25);
  expect(parsed.baseline.totals.reruns).toBe(1);
  expect(parsed.baseline.totals.reviewerApprovals).toBe(1);
});

test('mission-proof can emit JSON when appending a measured manual baseline run', async () => {
  const target = path.join('baselines', 'manual-runs.json');
  const realTmp = await fs.realpath(tmp);

  const append = await runCli([
    'mission-proof',
    '--add-baseline-run',
    target,
    '--id',
    'manual-1',
    '--status',
    'passed',
    '--minutes-spent',
    '25',
    '--reruns',
    '1',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(append.exitCode).toBe(0);
  expect(append.stderr).toBe('');
  expect(JSON.parse(append.stdout)).toEqual({
    writtenTo: path.join(realTmp, target),
    addedRun: {
      id: 'manual-1',
      status: 'passed',
      minutesSpent: 25,
      reruns: 1,
    },
    runCount: 1,
  });
});

test('mission-proof validates a manual baseline without scanning mission bundles', async () => {
  await fs.rm(path.join(tmp, '.projscan'), { recursive: true, force: true });
  const target = path.join('baselines', 'manual-runs.json');
  const realTmp = await fs.realpath(tmp);
  await fs.mkdir(path.join(tmp, 'baselines'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, target),
    JSON.stringify({
      schemaVersion: 1,
      runs: [
        { id: 'manual-1', status: 'passed', minutesSpent: 25 },
        { id: 'manual-2', status: 'failed', reruns: 2, failedGates: 1 },
      ],
    }) + '\n',
  );

  const result = await runCli(['mission-proof', '--check-baseline', target, '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim()).toBe(`Mission proof baseline valid: ${path.join(realTmp, target)} (2 run(s))`);
  expect(result.stderr).toBe('');
});

test('mission-proof check-baseline can emit JSON for automation', async () => {
  await fs.rm(path.join(tmp, '.projscan'), { recursive: true, force: true });
  const target = path.join('baselines', 'manual-runs.json');
  const realTmp = await fs.realpath(tmp);
  await fs.mkdir(path.join(tmp, 'baselines'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, target),
    JSON.stringify({
      schemaVersion: 1,
      runs: [
        { id: 'manual-1', status: 'passed', minutesSpent: 25 },
        { id: 'manual-2', status: 'failed', reruns: 2, failedGates: 1 },
      ],
    }) + '\n',
  );

  const result = await runCli(['mission-proof', '--check-baseline', target, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  const parsed = JSON.parse(result.stdout);
  expect(parsed).toEqual({
    valid: true,
    path: path.join(realTmp, target),
    runCount: 2,
    totals: {
      missions: 2,
      passed: 1,
      failed: 1,
      running: 0,
      notRun: 0,
      unavailable: 0,
      proofCompletionRate: 0.5,
      reruns: 2,
      failedGates: 1,
      reviewerApprovals: 0,
      minutesSpent: 25,
    },
  });
});

test('mission-proof check-baseline reuses baseline validation errors', async () => {
  await fs.rm(path.join(tmp, '.projscan'), { recursive: true, force: true });
  const target = path.join('baselines', 'bad-manual-runs.json');
  await fs.mkdir(path.join(tmp, 'baselines'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, target),
    JSON.stringify({
      schemaVersion: 1,
      runs: [{ id: 'manual-1', status: 'passed', minutesSpent: -1 }],
    }) + '\n',
  );

  const result = await runCli(['mission-proof', '--check-baseline', target, '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Mission proof baseline invalid at runs[0].minutesSpent: expected a non-negative number.');
  expect(result.stderr).toContain(`File: ${target}`);
});

test('start --mission includes the saved mission outcome in console output', async () => {
  const result = await runCli(['start', '--mission', '.projscan/mission', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Mission Outcome');
  expect(result.stdout).toContain('Status: passed');
  expect(result.stdout).toContain('Mission proof passed after 2 command(s).');
  expect(result.stdout).toContain('Version candidate: review_candidate');
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}

async function writeMission(root: string, relativeDir: string, status: 'passed' | 'failed'): Promise<void> {
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
      currentStep: { phaseId: 'ready_now', stepId: 'ready-1', command: 'projscan search "auth" --format json' },
    }) + '\n',
  );
  await fs.writeFile(
    path.join(proof, 'summary.json'),
    JSON.stringify({
      schemaVersion: 1,
      status,
      totalCommands: 2,
      nextAction: status === 'passed' ? 'run ./review.sh and choose a reviewer reply.' : 'inspect the failed log, fix the issue, then rerun ./mission.sh.',
    }) + '\n',
  );
  await fs.writeFile(
    path.join(proof, 'status.jsonl'),
    [
      JSON.stringify({ id: 'current-ready-1', label: 'Run current command', log: 'current-ready-1.log', command: 'projscan search "auth" --format json', exitCode: 0 }),
      JSON.stringify({ id: 'proof-1', label: 'Proof 1', log: 'proof-1.log', command: 'projscan preflight --mode before_edit --format json', exitCode: status === 'passed' ? 0 : 1 }),
    ].join('\n') + '\n',
  );
}

async function touchSummary(relativeDir: string, at: Date): Promise<void> {
  const summary = path.join(tmp, relativeDir, 'proof-logs', 'summary.json');
  await fs.utimes(summary, at, at);
}
