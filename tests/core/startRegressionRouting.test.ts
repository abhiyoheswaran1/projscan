import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns failing CI intent into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'CI is failing after this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('CI is failing after this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['ci', 'failing', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns direct CI fail questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why did CI fail',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('why did CI fail');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['ci', 'fail'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['why'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
});

test('start report turns GitHub Actions failures into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why is GitHub Actions failing',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('why is GitHub Actions failing');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['github', 'actions', 'failing']),
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['why'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
});

test('start report turns slow CI questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why is CI slow',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('why is CI slow');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['ci', 'slow'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns flaky CI questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'CI is flaky',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('CI is flaky');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['ci', 'flaky'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns flake reproduction questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what command reproduces the flake',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['command', 'reproduces', 'flake'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
});

test('start report turns build and lint failures into a focused regression plan', async () => {
  const root = await makeTempProject();

  const build = await computeStartReport(root, {
    intent: 'why did the build fail',
  });

  expect(build.mode).toBe('before_commit');
  expect(build.modeSource).toBe('intent');
  expect(build.modeReason).toContain('why did the build fail');
  expect(build.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['fail', 'build'],
    }),
  );
  expect(
    build.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['why'],
    }),
  );
  expect(build.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );

  const lint = await computeStartReport(root, {
    intent: 'lint is failing',
  });

  expect(lint.mode).toBe('before_commit');
  expect(lint.modeSource).toBe('intent');
  expect(lint.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['failing', 'lint'],
    }),
  );
  expect(
    lint.missionControl.alternatives?.find((route) => route.tool === 'projscan_doctor'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['lint'],
    }),
  );
  expect(lint.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
});

test('start report turns typecheck install and stack-trace failures into a focused regression plan', async () => {
  const root = await makeTempProject();

  const typecheck = await computeStartReport(root, {
    intent: 'typecheck is failing',
  });

  expect(typecheck.mode).toBe('before_commit');
  expect(typecheck.modeSource).toBe('intent');
  expect(typecheck.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['failing', 'typecheck'],
    }),
  );

  const install = await computeStartReport(root, {
    intent: 'npm install is failing',
  });

  expect(install.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['failing', 'install'],
    }),
  );
  expect(install.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );

  const stackTrace = await computeStartReport(root, {
    intent: 'debug this stack trace',
  });

  expect(stackTrace.mode).toBe('before_commit');
  expect(stackTrace.modeSource).toBe('intent');
  expect(stackTrace.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['debug', 'stack', 'trace'],
    }),
  );
  expect(stackTrace.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns smoke-check intent into a smoke regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what smoke checks should I run before commit',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['smoke', 'checks'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level smoke --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'smoke' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The smoke regression plan identifies the smallest health and preflight commands to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level smoke --format json',
  );
});

test('start report turns test-plan questions into the verification view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what tests should I run for my changes',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('what tests should I run for my changes');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['run', 'tests']),
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['changes'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view verify --intent "what tests should I run for my changes" --format json',
      tool: 'projscan_understand',
      args: { view: 'verify', intent: 'what tests should I run for my changes' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Verification tiers, direct-test gaps, and likely proof commands are reviewed before pushing or asking for review.',
      'The developer has the smallest rerunnable command plus the fallback full gate for the intended change.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view verify --intent "what tests should I run for my changes" --format json',
  );
});

test('start report turns proof-command questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what commands prove this works',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['prove', 'commands', 'works'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
});

test('start report turns proof-command shorthand into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'give me proof commands',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['proof', 'commands'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_evidence_pack'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['proof'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns pre-push command questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what commands should I run before pushing',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['commands', 'pushing'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns full regression intent into a full before-merge plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what full regression should I run before merge',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what full regression should I run before merge');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['regression', 'full'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level full --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'full' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The full regression plan identifies release-grade build, lint, stability, and test commands to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level full --format json',
  );
});

