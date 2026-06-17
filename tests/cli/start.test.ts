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
  expect(bugHuntReport.missionControl.readyActions[0].command).toBe(
    'projscan bug-hunt --format json',
  );
  expect(releaseReport.mode).toBe('release');
  expect(releaseReport.modeSource).toBe('intent');
  expect(releaseReport.recommendedWorkflow.id).toBe('release_approval');
  expect(releaseReport.firstTenMinutes.commands[2].command).toBe(
    'projscan preflight --mode before_merge --format json',
  );
  expect(releaseReport.missionControl.readyActions[0].command).toBe(
    'projscan release-train --format json',
  );
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
  expect(report.missionControl.primaryAction.command).toBe(
    'projscan preflight --mode before_commit --format json',
  );
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan preflight --mode before_edit --format json',
  );
  expect(report.missionControl.successCriteria).toContain(
    'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
  );
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
  expect(report.missionControl.primaryAction.command).toBe(
    'projscan preflight --mode before_commit --format json',
  );
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
