import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report marks default mode when neither mode nor mode-specific intent is supplied', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root);

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('No mode-specific intent');
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
