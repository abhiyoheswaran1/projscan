import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

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
