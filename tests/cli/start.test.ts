import { beforeEach, expect, test } from 'vitest';
import { runStartCli } from '../helpers/startCli.js';
import { makeTempProject } from '../helpers/startProject.js';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempProject();
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
  expect(
    report.firstTenMinutes.commands.map((step: { command: string }) => step.command),
  ).toContain('projscan evidence-pack --pr-comment');
  expect(report.coordinationHints.map((hint: { id: string }) => hint.id)).toContain(
    'current-worktree-check',
  );
  expect(report.nextActions.length).toBeGreaterThan(0);
});

test('start console prints trusted daily workflows before broad onboarding', async () => {
  const result = await runCli(['start', '--mode', 'before_edit', '--quiet']);

  expect(result.exitCode).toBe(0);
  const dailyIndex = result.stdout.indexOf('Daily Workflows');
  const missionIndex = result.stdout.indexOf('Mission Control');
  const firstTenIndex = result.stdout.indexOf('First 10 Minutes');
  expect(dailyIndex).toBeGreaterThanOrEqual(0);
  expect(missionIndex).toBeGreaterThan(dailyIndex);
  expect(firstTenIndex).toBeGreaterThan(dailyIndex);
  const dailySection = result.stdout.slice(dailyIndex, missionIndex);
  expect(dailySection).toContain(
    '  - projscan understand --view change --intent "add auth token refresh" --format json',
  );
  expect(dailySection).toContain('  - projscan preflight --mode before_edit --format json');
  expect(dailySection).toContain('  - projscan preflight --mode before_commit --format json');
  expect(dailySection).toContain('  - projscan evidence-pack --pr-comment');
  expect(dailySection).toContain('  - projscan preflight --mode before_merge --format json');
  expect(dailySection).toContain('- Before handoff or commit');
  expect(dailySection).toContain('  - projscan bug-hunt --format json');
  expect(dailySection).toContain('- Release-candidate review');
  expect(dailySection).toContain('  - projscan release-train --format json');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
