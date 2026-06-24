import { beforeEach, expect, test } from 'vitest';
import { runStartCli } from '../helpers/startCli.js';
import { makeTempProject } from '../helpers/startProject.js';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempProject();
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
  expect(report.recommendedWorkflow.id).toBe('before_handoff');
  expect(report.missionControl.primaryAction.command).toBe(
    'projscan assess --mode fix-first --format json',
  );
  expect(report.missionControl.primaryAction.tool).toBe('projscan_assess');
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_commit --format json',
  );
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan preflight --mode before_edit --format json',
  );
  expect(report.missionControl.successCriteria).toContain(
    'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
  );
});

test('start routes agent permission intents to an executable Proof Contract', async () => {
  const intent = 'is my agent allowed to change billing retry logic';
  const result = await runCli(['start', '--intent', intent, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_edit');
  expect(report.missionControl.routedIntent.tool).toBe('projscan_prove');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan prove --intent "is my agent allowed to change billing retry logic" --save-contract .projscan/proof-contract.json --format json',
      args: {
        intent,
        save_contract_path: '.projscan/proof-contract.json',
      },
    }),
  );
  expect(report.missionControl.successCriteria).toContain(
    'The agent has a saved Proof Contract with allowed files, forbidden files, and required proof commands before editing.',
  );
});

test('start keeps no-more-release continuation intents in the workplan workflow', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'keep improving projscan after 4.8.0 with user research and no more release today',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('intent');
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.missionControl.routedIntent.tool).toBe('projscan_workplan');
  expect(report.missionControl.primaryAction.command).toBe(
    'projscan workplan --mode before_edit --format json',
  );
  expect(report.missionControl.proofCommands).not.toContain('projscan release-train --format json');
});

test('start uses understand change view for before-edit change-prep read questions', async () => {
  const intent = 'what files should I read before adding auth token refresh';
  const result = await runCli(['start', '--intent', intent, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_edit');
  expect(report.missionControl.routedIntent.tool).toBe('projscan_understand');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view change --intent "what files should I read before adding auth token refresh" --format json',
      args: { view: 'change', intent },
    }),
  );
});

test('start keeps change-file planning out of dataflow hardening', async () => {
  const intent = 'where should I add auth token refresh';
  const result = await runCli(['start', '--intent', intent, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_edit');
  expect(report.missionControl.routedIntent.tool).toBe('projscan_understand');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view change --intent "where should I add auth token refresh" --format json',
      args: { view: 'change', intent },
    }),
  );
});

test('start uses release-candidate proof mode without publishing actions', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'prepare a release candidate review without publishing',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.recommendedWorkflow.id).toBe('pre_merge');
  expect(report.missionControl.primaryAction.command).toBe('projscan evidence-pack --pr-comment');
  expect(report.missionControl.primaryAction.command).not.toMatch(/publish|version|tag|push/);
  expect(report.missionControl.successCriteria).toContain(
    'The next task has a verification command: projscan preflight --mode before_merge --format json',
  );
});

test('start keeps read-only change summaries out of release mode', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'summary of work since last release',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_commit');
  expect(report.missionControl.routedIntent.tool).toBe('projscan_pr_diff');
  expect(report.missionControl.primaryAction.command).toBe('projscan pr-diff --format json');
  expect(report.missionControl.successCriteria).toContain(
    'The next task has a verification command: projscan preflight --mode before_commit --format json',
  );
  expect(report.missionControl.successCriteria).not.toContain(
    'The next task has a verification command: npm run release:check',
  );
});

test('start routes no-publish release readiness to read-only release proof', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'do not publish, just check release readiness',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_merge');
  expect(report.missionControl.routedIntent.tool).toBe('projscan_evidence_pack');
  expect(report.missionControl.primaryAction.command).toBe('projscan evidence-pack --pr-comment');
  expect(report.missionControl.primaryAction.command).not.toMatch(/publish|tag|push|version/);
  expect(report.missionControl.successCriteria).toContain(
    'The next task has a verification command: projscan preflight --mode before_merge --format json',
  );
});

test('start fills feedback intake primary action with raw install warning text', async () => {
  const intent =
    'npm install -g projscan got allow-scripts warnings from tree-sitter-c-sharp node-gyp-build';
  const result = await runCli(['start', '--intent', intent, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.routedIntent.tool).toBe('projscan_feedback_intake');
  expect(report.missionControl.primaryAction.command).toBe(
    'projscan feedback intake --text "npm install -g projscan got allow-scripts warnings from tree-sitter-c-sharp node-gyp-build" --format json',
  );
  expect(report.missionControl.primaryAction.command).not.toContain('<feedback>');
});

test('start routes docs-overclaim feedback to feedback intake', async () => {
  const intent = 'docs sound bigger than demonstrated workflows';
  const result = await runCli(['start', '--intent', intent, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.routedIntent.tool).toBe('projscan_feedback_intake');
  expect(report.missionControl.primaryAction.command).toBe(
    'projscan feedback intake --text "docs sound bigger than demonstrated workflows" --format json',
  );
});

test('start routes workflow-focus feedback to feedback intake', async () => {
  const intent = 'feature breadth without a few killer workflows that engineers trust daily';
  const result = await runCli(['start', '--intent', intent, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.routedIntent.tool).toBe('projscan_feedback_intake');
  expect(report.missionControl.primaryAction.command).toBe(
    'projscan feedback intake --text "feature breadth without a few killer workflows that engineers trust daily" --format json',
  );
});

test('start routes AI-generated code review-before-commit intents to structural review', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'review AI-generated code before commit for verification debt',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.mode).toBe('before_commit');
  expect(report.missionControl.routedIntent.tool).toBe('projscan_review');
  expect(report.missionControl.primaryAction.command).toBe('projscan review --format json');
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
