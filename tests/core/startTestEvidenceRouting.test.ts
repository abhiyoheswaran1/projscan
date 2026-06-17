import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns test-location questions into a focused search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where are the tests for src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['where', 'tests'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "tests for src/core/start.ts" --format json',
      tool: 'projscan_search',
      args: { query: 'tests for src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['tests'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "tests for src/core/start.ts" --format json',
  );

  const authTests = await computeStartReport(root, {
    intent: 'where are tests for auth',
  });

  expect(authTests.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['where', 'tests'],
    }),
  );
  expect(authTests.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "tests for auth" --format json',
      tool: 'projscan_search',
      args: { query: 'tests for auth' },
    }),
  );
  expect(authTests.missionControl.proofCommands).toContain(
    'projscan search "tests for auth" --format json',
  );
});

test('start report turns existing-test coverage lookup into focused search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'which tests cover auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      cli: 'projscan search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['tests', 'cover']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "tests for auth" --format json',
      tool: 'projscan_search',
      args: { query: 'tests for auth' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "tests for auth" --format json',
  );
});

test('start report turns exact-file test coverage questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is src/core/start.ts covered by tests?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['covered', 'tests'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['tests'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Coverage, hotspot risk, and related test evidence for the file are reviewed before editing starts.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns exact-file test-authoring questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what tests should I add for src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['add', 'tests'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['tests'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'File purpose, risky functions, coverage, and existing test evidence are reviewed before designing a new test.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns exact-file read-before-change questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should I read before changing src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['read'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_understand'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['read'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Purpose, imports, exports, ownership, tests, and risk are reviewed before changing the named file.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns coverage-gap intent into scariest untested files analysis', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what are the scariest untested files',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('what are the scariest untested files');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Tests',
      tool: 'projscan_coverage',
      confidence: 'high',
      matchedKeywords: ['scariest', 'untested'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coverage --format json',
      tool: 'projscan_coverage',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Coverage gaps are ranked by risk so the next test target is explicit.',
      'The selected file has either a new test plan, an owner, or a documented reason to defer.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan coverage --format json');

  const noTests = await computeStartReport(root, {
    intent: 'which files have no tests',
  });
  expect(noTests.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_coverage',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['files', 'no', 'tests']),
    }),
  );
  expect(noTests.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coverage --format json',
      tool: 'projscan_coverage',
      args: {},
    }),
  );
  expect(
    noTests.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toBeUndefined();
});
