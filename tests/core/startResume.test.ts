import { describe, expect, test } from 'vitest';
import {
  executionCursor,
  missionResume,
  proofCommandToolCall,
} from '../../src/core/startResume.js';
import type {
  MissionOutcome,
  StartExecutionCursor,
  StartExecutionPhase,
  StartExecutionPlan,
} from '../../src/types.js';

function planFromPhases(phases: StartExecutionPhase[]): StartExecutionPlan {
  const cursor = executionCursor(phases);
  return {
    summary: 'Fixture execution plan',
    currentPhase: cursor.phaseId,
    cursor,
    phases,
  };
}

function routedImpactPhases(): StartExecutionPhase[] {
  return [
    {
      id: 'next_action',
      title: 'Next Action',
      status: 'ready',
      steps: [
        {
          id: 'next-action-1',
          kind: 'tool',
          status: 'ready',
          label: 'Find exact target for impact analysis',
          command: 'projscan search "auth token loader" --format json',
          tool: 'projscan_search',
          args: { query: 'auth token loader' },
        },
      ],
    },
    {
      id: 'ready_now',
      title: 'Ready Commands',
      status: 'ready',
      steps: [
        {
          id: 'ready-1',
          kind: 'tool',
          status: 'ready',
          label: 'Find exact target for impact analysis',
          command: 'projscan search "auth token loader" --format json',
          tool: 'projscan_search',
          args: { query: 'auth token loader' },
          unlocks: ['input-1', 'input-2'],
        },
      ],
    },
    {
      id: 'resolve_inputs',
      title: 'Resolve Inputs',
      status: 'blocked',
      steps: [
        {
          id: 'input-1',
          kind: 'input',
          status: 'blocked',
          label: 'symbol',
          dependsOn: ['ready-1'],
          unlocks: ['follow-up-1'],
          placeholder: '<symbol-from-search>',
          instruction:
            'Replace <symbol-from-search> with an exported symbol returned by the search step.',
        },
        {
          id: 'input-2',
          kind: 'input',
          status: 'blocked',
          label: 'file',
          dependsOn: ['ready-1'],
          unlocks: ['follow-up-2'],
          placeholder: '<file-from-search>',
          instruction: 'Replace <file-from-search> with a file path returned by the search step.',
        },
      ],
    },
    {
      id: 'follow_up',
      title: 'Follow Up',
      status: 'pending',
      steps: [
        {
          id: 'follow-up-1',
          kind: 'tool',
          status: 'blocked',
          label: 'If search returns an exported symbol',
          command: 'projscan impact --symbol <symbol-from-search> --format json',
          tool: 'projscan_impact',
          args: { symbol: '<symbol-from-search>' },
          blockedBy: ['input-1'],
          dependsOn: ['ready-1', 'input-1'],
        },
        {
          id: 'follow-up-2',
          kind: 'tool',
          status: 'blocked',
          label: 'If search returns a file path',
          command: 'projscan impact <file-from-search> --format json',
          tool: 'projscan_impact',
          args: { file: '<file-from-search>' },
          blockedBy: ['input-2'],
          dependsOn: ['ready-1', 'input-2'],
        },
      ],
    },
    {
      id: 'proof',
      title: 'Proof',
      status: 'ready',
      steps: [
        {
          id: 'proof-1',
          kind: 'proof',
          status: 'ready',
          label: 'projscan search "auth token loader" --format json',
          command: 'projscan search "auth token loader" --format json',
        },
        {
          id: 'proof-2',
          kind: 'proof',
          status: 'ready',
          label: 'projscan preflight --mode before_edit --format json',
          command: 'projscan preflight --mode before_edit --format json',
          tool: 'projscan_preflight',
          args: { mode: 'before_edit' },
        },
        {
          id: 'proof-3',
          kind: 'proof',
          status: 'ready',
          label: 'projscan understand --view verify --format json',
          command: 'projscan understand --view verify --format json',
          tool: 'projscan_understand',
          args: { view: 'verify' },
        },
      ],
    },
    {
      id: 'done_when',
      title: 'Done When',
      status: 'pending',
      steps: [
        {
          id: 'criterion-1',
          kind: 'criterion',
          status: 'pending',
          label:
            'An exact symbol or file path is selected from search results before impact analysis continues.',
        },
      ],
    },
  ];
}

function outcomeFixture(): MissionOutcome {
  return {
    schemaVersion: 1,
    available: true,
    missionDir: '.projscan/missions/example',
    status: 'passed',
    proof: {
      completedCommands: 3,
      failedCommands: 0,
      reruns: 0,
      rows: [],
    },
    review: {
      decisions: [],
      approvals: 1,
      changeRequests: 0,
      versionCandidateReviews: 0,
    },
    whatChanged: [],
    whatRemains: [],
    versionCandidate: {
      recommendation: 'review_candidate',
      summary: 'Mission proof passed.',
    },
    resumePrompt: 'Mission proof passed.',
  };
}

describe('Mission Control resume state helpers', () => {
  test('selects the ready cursor and builds a resume checklist with inputs, follow-ups, proof, and references', () => {
    const plan = planFromPhases(routedImpactPhases());

    expect(plan.cursor).toEqual(
      expect.objectContaining({
        phaseId: 'ready_now',
        stepId: 'ready-1',
        status: 'ready',
        kind: 'tool',
        command: 'projscan search "auth token loader" --format json',
        tool: 'projscan_search',
        args: { query: 'auth token loader' },
        unlocks: ['input-1', 'input-2'],
        reason: 'Run this ready command next; it can unlock later inputs or follow-up steps.',
      }),
    );

    const resume = missionResume(plan);

    expect(resume).toEqual(
      expect.objectContaining({
        currentStep: plan.cursor,
        status: 'ready',
        commandBlock: 'projscan search "auth token loader" --format json',
        toolCall: {
          tool: 'projscan_search',
          args: { query: 'auth token loader' },
        },
        instruction: 'Run projscan search "auth token loader" --format json.',
        prompt:
          'Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
      }),
    );
    expect(resume.unlocks).toEqual([
      expect.objectContaining({
        id: 'input-1',
        phaseId: 'resolve_inputs',
        kind: 'input',
        status: 'blocked',
        label: 'symbol',
        placeholder: '<symbol-from-search>',
      }),
      expect.objectContaining({
        id: 'input-2',
        phaseId: 'resolve_inputs',
        kind: 'input',
        status: 'blocked',
        label: 'file',
        placeholder: '<file-from-search>',
      }),
    ]);
    expect(resume.inputBindings).toEqual([
      {
        inputId: 'input-1',
        label: 'symbol',
        placeholder: '<symbol-from-search>',
        instruction:
          'Replace <symbol-from-search> with an exported symbol returned by the search step.',
        followUpIds: ['follow-up-1'],
      },
      {
        inputId: 'input-2',
        label: 'file',
        placeholder: '<file-from-search>',
        instruction: 'Replace <file-from-search> with a file path returned by the search step.',
        followUpIds: ['follow-up-2'],
      },
    ]);
    expect(resume.followUps).toEqual([
      expect.objectContaining({
        id: 'follow-up-1',
        phaseId: 'follow_up',
        kind: 'tool',
        status: 'blocked',
        command: 'projscan impact --symbol <symbol-from-search> --format json',
        tool: 'projscan_impact',
        args: { symbol: '<symbol-from-search>' },
        blockedBy: ['input-1'],
      }),
      expect.objectContaining({
        id: 'follow-up-2',
        phaseId: 'follow_up',
        kind: 'tool',
        status: 'blocked',
        command: 'projscan impact <file-from-search> --format json',
        tool: 'projscan_impact',
        args: { file: '<file-from-search>' },
        blockedBy: ['input-2'],
      }),
    ]);

    const checklist = resume.checklist ?? [];
    expect(checklist.map((item) => item.kind)).toEqual([
      'run_current',
      'resolve_input',
      'resolve_input',
      'run_follow_up',
      'run_follow_up',
      'run_proof',
      'run_proof',
      'confirm_done',
    ]);
    expect(checklist).toContainEqual(
      expect.objectContaining({
        id: 'resume-ready-1',
        kind: 'run_current',
        phaseId: 'ready_now',
        stepId: 'ready-1',
        command: 'projscan search "auth token loader" --format json',
        unlocks: ['input-1', 'input-2'],
      }),
    );
    expect(checklist).toContainEqual(
      expect.objectContaining({
        id: 'resume-proof-2',
        kind: 'run_proof',
        phaseId: 'proof',
        stepId: 'proof-2',
        command: 'projscan preflight --mode before_edit --format json',
        tool: 'projscan_preflight',
        args: { mode: 'before_edit' },
      }),
    );
    expect(checklist).not.toContainEqual(
      expect.objectContaining({
        kind: 'run_proof',
        command: 'projscan search "auth token loader" --format json',
      }),
    );
    expect(resume.remainingProofCommands).toEqual([
      'projscan preflight --mode before_edit --format json',
      'projscan understand --view verify --format json',
    ]);
    expect(resume.remainingProofToolCalls).toEqual([
      {
        stepId: 'proof-2',
        command: 'projscan preflight --mode before_edit --format json',
        tool: 'projscan_preflight',
        args: { mode: 'before_edit' },
      },
      {
        stepId: 'proof-3',
        command: 'projscan understand --view verify --format json',
        tool: 'projscan_understand',
        args: { view: 'verify' },
      },
    ]);
    expect(resume.remainingProofItems).toEqual([
      {
        stepId: 'proof-2',
        status: 'ready',
        label: 'projscan preflight --mode before_edit --format json',
        command: 'projscan preflight --mode before_edit --format json',
        toolCall: {
          tool: 'projscan_preflight',
          args: { mode: 'before_edit' },
        },
      },
      {
        stepId: 'proof-3',
        status: 'ready',
        label: 'projscan understand --view verify --format json',
        command: 'projscan understand --view verify --format json',
        toolCall: {
          tool: 'projscan_understand',
          args: { view: 'verify' },
        },
      },
    ]);
  });

  test('describes blocked input and completed mission outcome resume states', () => {
    const phases = routedImpactPhases().filter((phase) => phase.id !== 'ready_now');
    const cursor: StartExecutionCursor = executionCursor(phases);
    const plan: StartExecutionPlan = {
      summary: 'Blocked fixture execution plan',
      currentPhase: cursor.phaseId,
      cursor,
      phases,
    };

    expect(cursor).toEqual(
      expect.objectContaining({
        phaseId: 'resolve_inputs',
        stepId: 'input-1',
        status: 'blocked',
        kind: 'input',
        placeholder: '<symbol-from-search>',
        reason: 'Resolve this blocked input before running dependent follow-up steps.',
      }),
    );

    const resume = missionResume(plan, outcomeFixture());

    expect(resume.status).toBe('blocked');
    expect(resume.commandBlock).toBeUndefined();
    expect(resume.instruction).toBe(
      'Resolve symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.',
    );
    expect(resume.prompt).toBe(
      'Mission proof passed. Resume at input-1 in resolve_inputs: Resolve symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.',
    );
    expect(resume.checklist?.[0]).toEqual(
      expect.objectContaining({
        id: 'resume-input-1',
        kind: 'resolve_input',
        phaseId: 'resolve_inputs',
        stepId: 'input-1',
        placeholder: '<symbol-from-search>',
      }),
    );
  });

  test('parses proof command tool calls from runnable proof commands', () => {
    expect(proofCommandToolCall('projscan preflight --mode before_commit --format json')).toEqual({
      tool: 'projscan_preflight',
      args: { mode: 'before_commit' },
    });
    expect(proofCommandToolCall('projscan assess --mode fix-first --format json')).toEqual({
      tool: 'projscan_assess',
      args: { mode: 'fix-first' },
    });
    expect(
      proofCommandToolCall(
        'projscan understand --view verify --intent "what tests should I run" --format json',
      ),
    ).toEqual({
      tool: 'projscan_understand',
      args: {
        view: 'verify',
        intent: 'what tests should I run',
      },
    });
    expect(proofCommandToolCall('projscan session touched --format json')).toEqual({
      tool: 'projscan_session',
      args: { action: 'touched' },
    });
    expect(proofCommandToolCall('projscan handoff')).toBeUndefined();
  });
});
