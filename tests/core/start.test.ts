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
