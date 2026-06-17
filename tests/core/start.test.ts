import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report routes build-next product-planning questions to bug-hunt workplan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should we build next',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what should we build next');
  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_workplan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['build', 'next']),
    }),
  );
  expect(report.missionControl.routedIntent?.matchedKeywords).not.toEqual(['next']);
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode bug_hunt --format json',
      tool: 'projscan_workplan',
      args: { mode: 'bug_hunt' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
      'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
    ]),
  );

  const roadmap = await computeStartReport(root, {
    intent: 'plan the product roadmap',
  });
  expect(roadmap.mode).toBe('bug_hunt');
  expect(roadmap.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode bug_hunt --format json',
      tool: 'projscan_workplan',
      args: { mode: 'bug_hunt' },
    }),
  );
  expect(roadmap.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
    ]),
  );
});

test('start report does not use bug-hunt criteria when explicit mode overrides product planning', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
    intent: 'what should we build next',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('explicit');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode before_edit --format json',
      tool: 'projscan_workplan',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.successCriteria).not.toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
      'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
    ]),
  );
});

test('start report routes generic lookup intents to search rather than bug hunt', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find the PR template',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('find the PR template');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_search',
      confidence: 'medium',
      matchedKeywords: ['find'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "the PR template" --format json',
      tool: 'projscan_search',
      args: { query: 'the PR template' },
    }),
  );
  expect(report.missionControl.alternatives?.map((route) => route.tool)).toContain(
    'projscan_bug_hunt',
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_bug_hunt'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'low',
      matchedKeywords: ['find', 'pr'],
    }),
  );
});

test('start report turns documentation lookup questions into search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find documentation for auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['find', 'documentation'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "documentation for auth" --format json',
      tool: 'projscan_search',
      args: { query: 'documentation for auth' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Search results identify the target files or symbols with enough confidence to choose the next tool.',
    ]),
  );
});

test('start report marks default mode when neither mode nor mode-specific intent is supplied', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root);

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('No mode-specific intent');
});

test('start report turns file explanation intent into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'explain src/core/start.ts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('explain src/core/start.ts');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['explain'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns exact-file risk questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why is src/core/start.ts risky?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['risky'],
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
    report.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_quality_scorecard',
    ),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['risky'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Hotspot reasons, related issues, imports, exports, and ownership explain why the file is risky.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns file ownership questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who owns src/core/start.ts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['owns'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns exact-file reviewer questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who should review src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['review'],
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
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_evidence_pack'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['who', 'review'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Ownership, primary author, hotspot risk, and related issues are reviewed before choosing a reviewer.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns file authorship questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who last touched src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['last', 'touched'],
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
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_session'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['touched', 'last'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Primary author, recent history, and ownership signals are reviewed before routing reviewers or changing the file.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns file importer intent into targeted semantic graph query', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who imports src/core/start.ts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: ['imports'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query importers --file src/core/start.ts --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'importers', file: 'src/core/start.ts' } },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The targeted graph query answers the importer/import/export question without dumping the full graph.',
      'Any returned files are reviewed before editing the queried file or symbol.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan semantic-graph --query importers --file src/core/start.ts --format json',
  );
});

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

test('start report turns package importer intent into targeted semantic graph query', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'which files import chalk',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: ['import'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query package_importers --symbol chalk --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'package_importers', symbol: 'chalk' } },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.proofCommands).toContain(
    'projscan semantic-graph --query package_importers --symbol chalk --format json',
  );

  const packageWord = await computeStartReport(root, {
    intent: 'which files import package chalk',
  });
  expect(packageWord.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['import']),
    }),
  );
  expect(packageWord.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query package_importers --symbol chalk --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'package_importers', symbol: 'chalk' } },
    }),
  );
  expect(
    packageWord.missionControl.alternatives?.find((route) => route.tool === 'projscan_upgrade'),
  ).toBeUndefined();

  const packageUse = await computeStartReport(root, {
    intent: 'who uses lodash',
  });
  expect(packageUse.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['uses']),
    }),
  );
  expect(packageUse.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query package_importers --symbol lodash --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'package_importers', symbol: 'lodash' } },
    }),
  );

  const whyDependency = await computeStartReport(root, {
    intent: 'why do we depend on lodash',
  });
  expect(whyDependency.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['depend']),
    }),
  );
  expect(whyDependency.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query package_importers --symbol lodash --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'package_importers', symbol: 'lodash' } },
    }),
  );
});

test('start report turns symbol definition intent into targeted semantic graph query', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where is runAudit defined',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: ['defined'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query symbol_defs --symbol runAudit --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'symbol_defs', symbol: 'runAudit' } },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.proofCommands).toContain(
    'projscan semantic-graph --query symbol_defs --symbol runAudit --format json',
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

test('start report turns package bump intent into direct upgrade preview', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I bump chalk to 6',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['bump'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan upgrade chalk --format json',
      tool: 'projscan_upgrade',
      args: { package: 'chalk' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The upgrade preview identifies declared version, installed version, breaking markers, and importers.',
      'Importer files are reviewed before changing the package version.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan upgrade chalk --format json');
});

test('start report turns package update intent into direct upgrade preview', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I update react',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['update'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan upgrade react --format json',
      tool: 'projscan_upgrade',
      args: { package: 'react' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['breaks'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan upgrade react --format json');
});

test('start report turns package removal intent into direct upgrade preview', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'can I remove lodash',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['remove'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan upgrade lodash --format json',
      tool: 'projscan_upgrade',
      args: { package: 'lodash' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The upgrade preview identifies declared version, installed version, breaking markers, and importers.',
      'Importer files are reviewed before changing the package version.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan upgrade lodash --format json');
});

test('start report turns reversed package removal intent into direct upgrade preview', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is lodash safe to remove',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is lodash safe to remove');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['remove'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan upgrade lodash --format json',
      tool: 'projscan_upgrade',
      args: { package: 'lodash' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_doctor'),
  ).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain('projscan upgrade lodash --format json');
});

test('start report turns package CVE questions into scoped audit', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'does lodash have a CVE',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_audit',
      confidence: 'high',
      matchedKeywords: ['cve'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan audit --package lodash --format json',
      tool: 'projscan_audit',
      args: { package: 'lodash' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'npm audit findings are reviewed for critical, high, moderate, low, and info vulnerabilities.',
      'Any vulnerable dependency has a fix, upgrade preview, or documented deferral before the branch is trusted.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan audit --package lodash --format json',
  );
});

test('start report turns repo CVE questions into audit', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what CVEs affect this repo',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_audit',
      confidence: 'high',
      matchedKeywords: ['cves'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan audit --format json',
      tool: 'projscan_audit',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['affect'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan audit --format json');
});

test('start report turns monorepo workspace questions into workspaces', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what workspaces are in this repo',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_workspaces',
      confidence: 'high',
      matchedKeywords: ['workspaces'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workspaces --format json',
      tool: 'projscan_workspaces',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Monorepo workspace packages are listed with names and relative paths before package-scoped work begins.',
      'The selected workspace name is available for package-scoped follow-up commands such as hotspots, coupling, review, or audit.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan workspaces --format json');
});

test('start report turns workspace ownership questions into workspaces', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'which workspace owns auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_workspaces',
      confidence: 'high',
      matchedKeywords: ['workspace', 'owns'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workspaces --format json',
      tool: 'projscan_workspaces',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim'),
  ).toBeUndefined();
});

test('start report searches before answering area ownership lookup', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who owns auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      cli: 'projscan search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['owns']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "auth" --format json',
      tool: 'projscan_search',
      args: { query: 'auth' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Search results identify the target files or symbols with enough confidence to choose the next tool.',
    ]),
  );

  const ask = await computeStartReport(root, {
    intent: 'who should I ask about auth',
  });
  expect(ask.mode).toBe('before_edit');
  expect(ask.modeSource).toBe('default');
  expect(ask.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      cli: 'projscan search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['ask']),
    }),
  );
  expect(ask.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "auth" --format json',
      tool: 'projscan_search',
      args: { query: 'auth' },
    }),
  );
  expect(
    ask.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim'),
  ).toBeUndefined();
});

test('start report lists outdated dependencies before upgrade preview when package is missing', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what package should I upgrade',
  });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['upgrade', 'package'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find package candidates before previewing an upgrade',
      command: 'projscan outdated --format json',
      tool: 'projscan_outdated',
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan outdated --format json',
    'projscan upgrade <package-from-outdated> --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan outdated --format json',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([
    {
      name: 'package',
      placeholder: '<package-from-outdated>',
      sourceAction: 'Find package candidates before previewing an upgrade',
      instruction:
        'Replace <package-from-outdated> with a package name from projscan outdated or projscan dependencies.',
    },
  ]);
  expect(report.missionControl.whyNow).toContain('run projscan_outdated first');
  expect(report.missionControl.proofCommands).toContain('projscan outdated --format json');
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan upgrade <package-from-outdated> --format json',
  );
});

test('start report turns dependency inventory questions into dependency analysis', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what dependencies does this repo use',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_dependencies',
      confidence: 'high',
      matchedKeywords: ['dependencies'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dependencies --format json',
      tool: 'projscan_dependencies',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Declared production and development dependencies are inventoried before package changes are planned.',
      'Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan dependencies --format json');
});

test('start report turns open-source compliance questions into dependency license inventory', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'open source compliance check',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_dependencies',
      cli: 'projscan dependencies',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['open', 'source', 'compliance']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dependencies --format json',
      tool: 'projscan_dependencies',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Dependency license counts, unknown licenses, and copyleft risks are reviewed before third-party notices or compliance sign-off.',
    ]),
  );
});

test('start report turns bundle-size questions into dependency size inventory', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why is the bundle so large',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_dependencies',
      cli: 'projscan dependencies',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['bundle', 'large']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dependencies --format json',
      tool: 'projscan_dependencies',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Installed package-size totals and largest packages are reviewed before bundle-size or dependency-bloat work starts.',
    ]),
  );
});

test('start report turns circular dependency questions into cycles-only coupling analysis', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'show circular dependencies',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Architecture',
      tool: 'projscan_coupling',
      cli: 'projscan coupling',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['circular', 'dependencies']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Inspect circular import cycles',
      command: 'projscan coupling --cycles-only --format json',
      tool: 'projscan_coupling',
      args: { direction: 'cycles_only' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Circular-import cycles are reviewed with the exact files participating in each strongly connected component.',
      'Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan coupling --cycles-only --format json',
  );
});

test('start report turns module coupling questions into full coupling analysis', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what modules are tightly coupled',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Architecture',
      tool: 'projscan_coupling',
      cli: 'projscan coupling',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['modules', 'coupled']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Inspect file coupling and instability',
      command: 'projscan coupling --format json',
      tool: 'projscan_coupling',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Fan-in, fan-out, instability, cross-package edges, and circular-import cycles are reviewed before refactoring boundaries.',
      'Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.',
    ]),
  );
});

test('mission control keeps alternative routes for mixed intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is it safe to commit and what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.routedIntent?.tool).toBe('projscan_impact');
  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.alternatives?.map((route) => route.tool)).toContain(
    'projscan_preflight',
  );
  expect(report.missionControl.alternatives?.[0]).toEqual(
    expect.objectContaining({
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
      confidence: 'high',
      matchedKeywords: ['safe', 'commit'],
    }),
  );
});

test('mission control does not duplicate preflight proof when intent routes to a safety gate', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is it safe to commit this change',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is it safe to commit this change');
  expect(report.recommendedWorkflow.id).toBe('pre_merge');
  expect(report.firstTenMinutes.commands.slice(0, 3).map((step) => step.command)).toEqual([
    'projscan privacy-check --offline',
    'projscan start --mode before_commit',
    'projscan preflight --mode before_commit --format json',
  ]);
  expect(report.coordinationHints[0]?.command).toBe(
    'projscan preflight --mode before_commit --format json',
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
    }),
  );
  expect(report.missionControl.proofCommands[0]).toBe(
    'projscan preflight --mode before_commit --format json',
  );
  expect(report.missionControl.primaryAction.args).toEqual({ mode: 'before_commit' });
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan preflight --mode before_edit --format json',
  );
  const nextActionCommands = report.nextActions
    .map((action) => action.command)
    .filter((command): command is string => typeof command === 'string');
  expect(nextActionCommands).toEqual([...new Set(nextActionCommands)]);
  expect(
    nextActionCommands.filter(
      (command) => command === 'projscan preflight --mode before_commit --format json',
    ),
  ).toHaveLength(1);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
      'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
    ]),
  );
});

test('start report preserves an explicit mode when intent suggests a different workflow', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
    intent: 'is it safe to commit this change',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('explicit');
  expect(report.modeReason).toContain('explicit');
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
    }),
  );
});

test('start report routes PR blocker questions to before-commit preflight', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what is blocking this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what is blocking this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Safety gate',
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
      confidence: 'high',
      matchedKeywords: ['blocking'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_commit' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
      'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_commit --format json',
  );
});

test('start report routes merge-readiness questions to before-merge preflight', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is my branch ready to merge',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is my branch ready to merge');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Safety gate',
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
      confidence: 'high',
      matchedKeywords: ['merge', 'ready'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_merge --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_merge' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'projscan preflight --mode before_merge returns proceed or only documented manual-review items.',
      'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_merge --format json',
  );
});

test('start report recommends the bug-hunt recipe for bug_hunt mode', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, { mode: 'bug_hunt', maxTasks: 2 });

  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.recommendedWorkflow.name).toBe('Bug Hunt');
  expect(report.recommendedWorkflow.mcpTools).toContain('projscan_bug_hunt');
});

test('start report infers bug-hunt mode from bug-fix intent', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, { intent: 'find bugs to fix before the PR' });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('find bugs to fix before the PR');
  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions.map((action) => action.command)).toContain(
    'projscan bug-hunt --format json',
  );
});
