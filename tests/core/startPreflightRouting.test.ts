import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

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
  expect(report.recommendedWorkflow.id).toBe('before_handoff');
  expect(report.recommendedWorkflow.name).toBe('Before handoff or commit');
  expect(report.recommendedWorkflow.commands).toEqual([
    'projscan bug-hunt --format json',
    'projscan preflight --mode before_commit --format json',
    'projscan evidence-pack --pr-comment',
  ]);
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

test('start report keeps pre-merge workflow for merge safety gates', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_merge',
    intent: 'is it safe to merge this branch',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.recommendedWorkflow.id).toBe('pre_merge');
  expect(report.recommendedWorkflow.name).toBe('Pre-Merge');
  expect(report.recommendedWorkflow.commands).toContain(
    'projscan preflight --mode before_merge --format json',
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
