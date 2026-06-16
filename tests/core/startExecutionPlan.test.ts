import { describe, expect, test } from 'vitest';
import {
  actionToExecutionStep,
  buildMissionExecutionPlan,
  executionPlanSummary,
  executionStatusForAction,
  isReadyAction,
  placeholdersInAction,
} from '../../src/core/startExecutionPlan.js';
import type { PreflightSuggestedAction, StartUnresolvedInput } from '../../src/types.js';

const searchAction: PreflightSuggestedAction = {
  label: 'Find exact target for impact analysis',
  command: 'projscan search "auth token loader" --format json',
  tool: 'projscan_search',
  args: { query: 'auth token loader' },
};

const symbolImpactAction: PreflightSuggestedAction = {
  label: 'If search returns an exported symbol',
  command: 'projscan impact --symbol <symbol-from-search> --format json',
  tool: 'projscan_impact',
  args: { symbol: '<symbol-from-search>' },
};

const fileImpactAction: PreflightSuggestedAction = {
  label: 'If search returns a file path',
  command: 'projscan impact <file-from-search> --format json',
  tool: 'projscan_impact',
  args: { file: '<file-from-search>' },
};

const unresolvedInputs: StartUnresolvedInput[] = [
  {
    name: 'symbol',
    placeholder: '<symbol-from-search>',
    sourceAction: searchAction.label,
    instruction:
      'Replace <symbol-from-search> with an exported symbol returned by the search step.',
  },
  {
    name: 'file',
    placeholder: '<file-from-search>',
    sourceAction: searchAction.label,
    instruction: 'Replace <file-from-search> with a file path returned by the search step.',
  },
];

describe('Mission Control execution plan builder', () => {
  test('builds the phased plan with ready unlocks, blocked follow-ups, proof tool calls, and done criteria', () => {
    const plan = buildMissionExecutionPlan({
      primaryAction: searchAction,
      actionPlan: [searchAction, symbolImpactAction, fileImpactAction],
      readyActions: [searchAction],
      unresolvedInputs,
      successCriteria: [
        'An exact symbol or file path is selected from search results before impact analysis continues.',
      ],
      proofCommands: [
        'projscan search "auth token loader" --format json',
        'projscan preflight --mode before_edit --format json',
        'projscan understand --view verify --format json',
      ],
    });

    expect(plan.summary).toBe(
      'Run 1 ready step, resolve 2 input(s), then gather 3 proof command(s).',
    );
    expect(plan.currentPhase).toBe('ready_now');
    expect(plan.cursor).toEqual(
      expect.objectContaining({
        phaseId: 'ready_now',
        stepId: 'ready-1',
        kind: 'tool',
        status: 'ready',
        command: 'projscan search "auth token loader" --format json',
        tool: 'projscan_search',
        args: { query: 'auth token loader' },
        unlocks: ['input-1', 'input-2'],
      }),
    );
    expect(plan.phases.map((phase) => `${phase.id}:${phase.status}`)).toEqual([
      'next_action:ready',
      'ready_now:ready',
      'resolve_inputs:blocked',
      'follow_up:pending',
      'proof:ready',
      'done_when:pending',
    ]);
    expect(plan.phases.find((phase) => phase.id === 'ready_now')?.steps[0]).toEqual(
      expect.objectContaining({
        id: 'ready-1',
        unlocks: ['input-1', 'input-2'],
      }),
    );
    expect(plan.phases.find((phase) => phase.id === 'resolve_inputs')?.steps).toEqual([
      expect.objectContaining({
        id: 'input-1',
        kind: 'input',
        status: 'blocked',
        dependsOn: ['ready-1'],
        unlocks: ['follow-up-1'],
        placeholder: '<symbol-from-search>',
      }),
      expect.objectContaining({
        id: 'input-2',
        kind: 'input',
        status: 'blocked',
        dependsOn: ['ready-1'],
        unlocks: ['follow-up-2'],
        placeholder: '<file-from-search>',
      }),
    ]);
    expect(plan.phases.find((phase) => phase.id === 'follow_up')?.steps).toEqual([
      expect.objectContaining({
        id: 'follow-up-1',
        status: 'blocked',
        blockedBy: ['input-1'],
        dependsOn: ['ready-1', 'input-1'],
        command: 'projscan impact --symbol <symbol-from-search> --format json',
        args: { symbol: '<symbol-from-search>' },
      }),
      expect.objectContaining({
        id: 'follow-up-2',
        status: 'blocked',
        blockedBy: ['input-2'],
        dependsOn: ['ready-1', 'input-2'],
        command: 'projscan impact <file-from-search> --format json',
        args: { file: '<file-from-search>' },
      }),
    ]);
    expect(plan.phases.find((phase) => phase.id === 'proof')?.steps[1]).toEqual(
      expect.objectContaining({
        id: 'proof-2',
        kind: 'proof',
        status: 'ready',
        command: 'projscan preflight --mode before_edit --format json',
        tool: 'projscan_preflight',
        args: { mode: 'before_edit' },
      }),
    );
    expect(plan.phases.find((phase) => phase.id === 'done_when')?.steps[0]).toEqual({
      id: 'criterion-1',
      kind: 'criterion',
      status: 'pending',
      label:
        'An exact symbol or file path is selected from search results before impact analysis continues.',
    });
  });

  test('builds an unblocked ready plan without input or follow-up phases', () => {
    const preflightAction: PreflightSuggestedAction = {
      label: 'Use projscan_preflight for is it safe to commit this change',
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_commit' },
    };

    const plan = buildMissionExecutionPlan({
      primaryAction: preflightAction,
      actionPlan: [preflightAction],
      readyActions: [preflightAction],
      unresolvedInputs: [],
      successCriteria: [
        'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
      ],
      proofCommands: ['projscan preflight --mode before_commit --format json'],
    });

    expect(plan.summary).toBe('Run 1 ready step, then gather 1 proof command(s).');
    expect(plan.phases.map((phase) => phase.id)).toEqual([
      'next_action',
      'ready_now',
      'proof',
      'done_when',
    ]);
    expect(plan.cursor).toEqual(
      expect.objectContaining({
        phaseId: 'ready_now',
        stepId: 'ready-1',
        reason: 'Run this ready command next.',
      }),
    );
    expect(plan.phases.some((phase) => phase.id === 'resolve_inputs')).toBe(false);
    expect(plan.phases.some((phase) => phase.id === 'follow_up')).toBe(false);
  });

  test('exposes action readiness, placeholder extraction, step conversion, and summary helpers', () => {
    expect(isReadyAction(searchAction)).toBe(true);
    expect(actionToExecutionStep('ready-1', searchAction)).toEqual({
      id: 'ready-1',
      kind: 'tool',
      status: 'ready',
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
    });
    expect(
      executionStatusForAction({
        label: 'Run selected symbol impact',
        tool: 'projscan_impact',
        args: { symbol: 'buildCodeGraph' },
      }),
    ).toBe('ready');
    expect(
      executionStatusForAction({
        label: 'Manual review step',
      }),
    ).toBe('pending');
    expect(executionStatusForAction(symbolImpactAction)).toBe('blocked');
    expect(
      placeholdersInAction({
        label: 'Nested placeholder action',
        command: 'projscan impact <file-from-search> --format json',
        args: { filters: ['safe', '<symbol-from-search>'] },
      }),
    ).toEqual(['<file-from-search>', '<symbol-from-search>']);
    expect(executionPlanSummary(0, 0, 0)).toBe('Run 0 ready steps.');
  });
});
