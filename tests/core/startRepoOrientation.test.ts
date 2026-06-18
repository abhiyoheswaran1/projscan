import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns read-first orientation questions into repo understanding', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what files should I read first',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('what files should I read first');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['read'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_bug_hunt'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['first'],
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view map --format json',
  );

  const npmScripts = await computeStartReport(root, {
    intent: 'what npm scripts exist',
  });
  expect(npmScripts.mode).toBe('before_edit');
  expect(npmScripts.modeSource).toBe('default');
  expect(npmScripts.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['npm', 'scripts']),
    }),
  );
  expect(npmScripts.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(npmScripts.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Package scripts, test commands, and config contracts are reviewed before running local commands.',
      'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
    ]),
  );
  expect(
    npmScripts.missionControl.alternatives?.find((route) => route.tool === 'projscan_outdated'),
  ).toBeUndefined();
  expect(
    npmScripts.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_regression_plan',
    ),
  ).toBeUndefined();

  const installWarning = await computeStartReport(root, {
    intent: 'npm install -g projscan printed allow-scripts warnings',
  });
  expect(installWarning.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(installWarning.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['install', 'warnings']),
    }),
  );

  const e2eScript = await computeStartReport(root, {
    intent: 'which script runs e2e tests',
  });
  expect(e2eScript.mode).toBe('before_edit');
  expect(e2eScript.modeSource).toBe('default');
  expect(e2eScript.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['script', 'runs', 'tests']),
    }),
  );
  expect(e2eScript.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(e2eScript.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Package scripts, test commands, and config contracts are reviewed before running local commands.',
      'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
    ]),
  );
  expect(
    e2eScript.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_regression_plan',
    ),
  ).toBeUndefined();

  const lintCommand = await computeStartReport(root, {
    intent: 'what command runs lint',
  });
  expect(lintCommand.mode).toBe('before_edit');
  expect(lintCommand.modeSource).toBe('default');
  expect(lintCommand.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(lintCommand.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      matchedKeywords: expect.arrayContaining(['command', 'runs', 'lint']),
    }),
  );

  const typecheckCommand = await computeStartReport(root, {
    intent: 'how do I run typecheck',
  });
  expect(typecheckCommand.mode).toBe('before_edit');
  expect(typecheckCommand.modeSource).toBe('default');
  expect(typecheckCommand.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );

  const storybookCommand = await computeStartReport(root, {
    intent: 'how do I run storybook',
  });
  expect(storybookCommand.mode).toBe('before_edit');
  expect(storybookCommand.modeSource).toBe('default');
  expect(storybookCommand.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['run', 'storybook']),
    }),
  );
  expect(storybookCommand.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(storybookCommand.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Package scripts, test commands, and config contracts are reviewed before running local commands.',
      'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
    ]),
  );

  const cypressCommand = await computeStartReport(root, {
    intent: 'how do I run cypress tests',
  });
  expect(cypressCommand.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['run', 'cypress', 'tests']),
    }),
  );
  expect(cypressCommand.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(
    cypressCommand.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_regression_plan',
    ),
  ).toBeUndefined();

  const failingE2e = await computeStartReport(root, {
    intent: 'e2e tests are failing',
  });
  expect(failingE2e.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
});

test('start report turns first-time codebase orientation phrasing into repo understanding', async () => {
  const root = await makeTempProject();

  const start = await computeStartReport(root, {
    intent: 'where do I start in this codebase',
  });

  expect(start.mode).toBe('before_edit');
  expect(start.modeSource).toBe('default');
  expect(start.modeReason).toContain('where do I start in this codebase');
  expect(start.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['codebase', 'start'],
    }),
  );
  expect(start.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
  expect(start.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );

  const tour = await computeStartReport(root, {
    intent: 'give me a tour of the repo',
  });
  expect(tour.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['repo', 'tour'],
    }),
  );
  expect(tour.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );

  const architecture = await computeStartReport(root, {
    intent: 'explain the architecture',
  });
  expect(architecture.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['architecture'],
    }),
  );
  expect(architecture.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
});

test('start report turns repo summary questions into cited repo understanding', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'summarize this repo',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('summarize this repo');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['summarize'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view map --format json',
  );
});

test('start report turns project run questions into the repo map instead of hotspots', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how do I run this project',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['run', 'project'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view map --format json',
  );
});

test('start report turns proactive proof-selection questions into the verification view', async () => {
  const root = await makeTempProject();

  const fileProof = await computeStartReport(root, {
    intent: 'which tests should I run for src/core/start.ts?',
  });

  expect(fileProof.mode).toBe('before_edit');
  expect(fileProof.modeSource).toBe('default');
  expect(fileProof.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['run', 'tests']),
    }),
  );
  expect(fileProof.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view verify --intent "which tests should I run for src/core/start.ts?" --format json',
      tool: 'projscan_understand',
      args: { view: 'verify', intent: 'which tests should I run for src/core/start.ts?' },
    }),
  );
  expect(fileProof.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Verification tiers, direct-test gaps, and likely proof commands are reviewed before pushing or asking for review.',
      'The developer has the smallest rerunnable command plus the fallback full gate for the intended change.',
    ]),
  );
  expect(fileProof.missionControl.proofCommands).toContain(
    'projscan understand --view verify --intent "which tests should I run for src/core/start.ts?" --format json',
  );
  expect(
    fileProof.missionControl.alternatives?.find((route) => route.tool === 'projscan_search'),
  ).toBeUndefined();

  const beforePush = await computeStartReport(root, {
    intent: 'what should I test before pushing',
  });

  expect(beforePush.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view verify --intent "what should I test before pushing" --format json',
      tool: 'projscan_understand',
      args: { view: 'verify', intent: 'what should I test before pushing' },
    }),
  );
  expect(
    beforePush.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_regression_plan',
    ),
  ).toBeUndefined();

  const failingTests = await computeStartReport(root, {
    intent: 'tests are failing',
  });
  expect(failingTests.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
});
