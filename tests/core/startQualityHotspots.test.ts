import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns quality and risk picture questions into a scorecard', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what is risky in this repo',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Health',
      tool: 'projscan_quality_scorecard',
      confidence: 'high',
      matchedKeywords: ['risky'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan quality-scorecard --format json',
      tool: 'projscan_quality_scorecard',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Quality dimensions, top risks, and verification commands are reviewed before choosing the next task.',
      'The developer knows whether health, security, tests, maintainability, or coordination needs attention first.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan quality-scorecard --format json');
});

test('start report turns risky-file touch questions into hotspots', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what files are risky to touch',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Hotspots',
      tool: 'projscan_hotspots',
      cli: 'projscan hotspots',
      confidence: 'high',
      matchedKeywords: ['risky', 'files', 'touch'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
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
  expect(report.missionControl.proofCommands).toContain('projscan hotspots --format json');
});

test('start report turns complexity and refactor focus questions into hotspots', async () => {
  const root = await makeTempProject();

  const complex = await computeStartReport(root, {
    intent: 'which files are too complex',
  });

  expect(complex.mode).toBe('before_edit');
  expect(complex.modeSource).toBe('default');
  expect(complex.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Hotspots',
      tool: 'projscan_hotspots',
      confidence: 'high',
      matchedKeywords: ['files', 'complex'],
    }),
  );
  expect(complex.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );

  const refactor = await computeStartReport(root, {
    intent: 'what file should I refactor first',
  });

  expect(refactor.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_hotspots',
      confidence: 'high',
      matchedKeywords: ['file', 'refactor'],
    }),
  );
  expect(refactor.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );
  expect(
    refactor.missionControl.alternatives?.find((route) => route.tool === 'projscan_file'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['file'],
    }),
  );
});

test('start report turns performance bottleneck questions into hotspots', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find performance bottlenecks',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Hotspots',
      tool: 'projscan_hotspots',
      confidence: 'high',
      matchedKeywords: ['performance', 'bottlenecks'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan hotspots --format json');
});

test('start report turns tech debt simplification into hotspots', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what tech debt should I pay down',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Hotspots',
      tool: 'projscan_hotspots',
      cli: 'projscan hotspots',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['tech', 'debt']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );
});
