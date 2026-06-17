import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns dead-code cleanup questions into a doctor pass', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find dead code and unused exports I can delete',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Health',
      tool: 'projscan_doctor',
      confidence: 'high',
      matchedKeywords: ['dead', 'unused'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Dead code, unused exports, lint, dependency, security, and config issues are reviewed before cleanup starts.',
      'Any issue chosen for cleanup has a fix-suggest, impact, or verification follow-up before files are deleted.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan doctor --format json');

  const deadCode = await computeStartReport(root, {
    intent: 'find dead code',
  });

  expect(deadCode.mode).toBe('before_edit');
  expect(deadCode.modeSource).toBe('default');
  expect(deadCode.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Health',
      tool: 'projscan_doctor',
      confidence: 'high',
      matchedKeywords: ['dead'],
    }),
  );
  expect(deadCode.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
      args: {},
    }),
  );
});

test('start report turns broad safe-delete questions into a doctor cleanup pass', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what can I safely delete?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Health',
      tool: 'projscan_doctor',
      confidence: 'high',
      matchedKeywords: ['safely', 'delete'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact'),
  ).toBeUndefined();
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Dead code, unused exports, lint, dependency, security, and config issues are reviewed before cleanup starts.',
      'Any issue chosen for cleanup has a fix-suggest, impact, or verification follow-up before files are deleted.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan doctor --format json');

  const safeRemove = await computeStartReport(root, {
    intent: 'what can I remove safely?',
  });
  expect(safeRemove.mode).toBe('before_edit');
  expect(safeRemove.modeSource).toBe('default');
  expect(safeRemove.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_doctor',
      confidence: 'high',
      matchedKeywords: ['safely', 'remove'],
    }),
  );
  expect(safeRemove.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
      args: {},
    }),
  );
  expect(
    safeRemove.missionControl.alternatives?.find((route) => route.tool === 'projscan_upgrade'),
  ).toBeUndefined();
});
