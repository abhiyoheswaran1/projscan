import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns first-fix prioritization into a bug-hunt queue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should I fix first',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what should I fix first');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_bug_hunt',
      confidence: 'high',
      matchedKeywords: ['first', 'fix'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_fix_suggest'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'medium',
      matchedKeywords: ['fix'],
    }),
  );
});

test('start report turns fastest safe fix questions into a bug-hunt queue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what is the fastest safe fix',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what is the fastest safe fix');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_bug_hunt',
      confidence: 'high',
      matchedKeywords: ['fastest', 'fix'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_preflight'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'medium',
      matchedKeywords: ['safe'],
    }),
  );
});

test('start report turns quick-win wording into a bug-hunt queue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find a quick win',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('find a quick win');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_bug_hunt',
      confidence: 'high',
      matchedKeywords: ['quick', 'find', 'win'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
});

test('start report turns broad improve next wording into a bug-hunt planning queue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should we improve next',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what should we improve next');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_bug_hunt',
      confidence: 'high',
      matchedKeywords: ['improve'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
});

test('start report turns tiny safe task prompts into bug-hunt', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what can I do in five minutes',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_bug_hunt',
      cli: 'projscan bug-hunt',
      confidence: 'high',
      matchedKeywords: ['five', 'minutes'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
});
