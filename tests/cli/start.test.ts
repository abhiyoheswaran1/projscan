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

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
