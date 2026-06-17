import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('mission control runs impact directly when the intent names an exact symbol', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename `buildCodeGraph`',
  });

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact --symbol buildCodeGraph --format json',
      tool: 'projscan_impact',
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan impact --symbol buildCodeGraph --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan impact --symbol buildCodeGraph --format json',
  ]);
  expect(report.missionControl.primaryAction.args).toEqual({ symbol: 'buildCodeGraph' });
  expect(report.missionControl.unresolvedInputs).toEqual([]);
});

test('mission control runs symbol impact directly for usage questions', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where is runAudit used',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['used'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact --symbol runAudit --format json',
      tool: 'projscan_impact',
      args: { symbol: 'runAudit' },
    }),
  );
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan impact --symbol runAudit --format json',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
      'Affected call sites, tests, or owners are added to the workplan before code changes begin.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan impact --symbol runAudit --format json',
  );
});

test('mission control runs file impact directly when the intent names a path', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I change src/core/start.ts',
  });

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact src/core/start.ts --format json',
      tool: 'projscan_impact',
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan impact src/core/start.ts --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan impact src/core/start.ts --format json',
  ]);
  expect(report.missionControl.primaryAction.args).toEqual({ file: 'src/core/start.ts' });
});

test('mission control runs file impact directly for deletion questions', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'can I delete src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['delete'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact src/core/start.ts --format json',
      tool: 'projscan_impact',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_start'),
  ).toBeUndefined();
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots'),
  ).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain(
    'projscan impact src/core/start.ts --format json',
  );
});

test('mission control runs file impact directly for exact-file rollback questions', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'revert src/core/start.ts safely',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['revert'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact src/core/start.ts --format json',
      tool: 'projscan_impact',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
      'Affected call sites, tests, or owners are added to the workplan before code changes begin.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan impact src/core/start.ts --format json',
  );
});

test('mission control searches for a target before generic rollback impact', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how do I revert this change safely',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['revert'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find exact target for impact analysis',
      command: 'projscan search "how do I revert this change safely" --format json',
      tool: 'projscan_search',
      args: { query: 'how do I revert this change safely' },
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan search "how do I revert this change safely" --format json',
    'projscan impact --symbol <symbol-from-search> --format json',
    'projscan impact <file-from-search> --format json',
  ]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'An exact symbol or file path is selected from search results before impact analysis continues.',
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "how do I revert this change safely" --format json',
  );
});

test('mission control searches for a target before schema-drop impact', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'can I drop this column',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['drop', 'column'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find exact target for impact analysis',
      command: 'projscan search "can I drop this column" --format json',
      tool: 'projscan_search',
      args: { query: 'can I drop this column' },
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan search "can I drop this column" --format json',
    'projscan impact --symbol <symbol-from-search> --format json',
    'projscan impact <file-from-search> --format json',
  ]);
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "can I drop this column" --format json',
  );
});

test('mission control runs file impact directly for dependency questions', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what depends on src/core/start.ts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['depends'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact src/core/start.ts --format json',
      tool: 'projscan_impact',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan impact src/core/start.ts --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan impact src/core/start.ts --format json',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.proofCommands).toContain(
    'projscan impact src/core/start.ts --format json',
  );
});
