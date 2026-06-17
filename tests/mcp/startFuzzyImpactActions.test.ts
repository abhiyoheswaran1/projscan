import { beforeEach, expect, test } from 'vitest';
import { makeTempProject } from '../helpers/startProject.js';
import { runFuzzyImpactStart } from './startFuzzyImpactHelper.js';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempProject();
});

test('projscan_start exposes fuzzy-impact actions and resume proof inputs', async () => {
  const start = await runFuzzyImpactStart(tmp);

  expect(start.missionControl.actionPlan[0]).toEqual(
    expect.objectContaining({
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(start.missionControl.readyActions).toEqual([
    expect.objectContaining({
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      command: 'projscan search "auth token loader" --format json',
    }),
  ]);
  expect(start.missionControl.actionPlan[1]).toEqual(
    expect.objectContaining({
      tool: 'projscan_impact',
      args: { symbol: '<symbol-from-search>' },
    }),
  );
  expect(start.missionControl.actionPlan[2]).toEqual(
    expect.objectContaining({
      tool: 'projscan_impact',
      args: { file: '<file-from-search>' },
    }),
  );
  expect(start.missionControl.unresolvedInputs).toEqual([
    expect.objectContaining({
      name: 'symbol',
      placeholder: '<symbol-from-search>',
      sourceAction: 'Find exact target for impact analysis',
    }),
    expect.objectContaining({
      name: 'file',
      placeholder: '<file-from-search>',
      sourceAction: 'Find exact target for impact analysis',
    }),
  ]);
  expect(start.missionControl.proofSummary).toBe(
    'Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
  );
  expect(start.missionControl.successCriteria).toContain(
    'An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(start.missionControl.handoff.nextAction).toEqual(
    expect.objectContaining({
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(start.missionControl.resume).toEqual(
    expect.objectContaining({
      currentStep: start.missionControl.executionPlan.cursor,
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
  expect(start.missionControl.resume.unlocks).toEqual([
    expect.objectContaining({
      id: 'input-1',
      phaseId: 'resolve_inputs',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
    expect.objectContaining({
      id: 'input-2',
      phaseId: 'resolve_inputs',
      label: 'file',
      placeholder: '<file-from-search>',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    }),
  ]);
  expect(start.missionControl.resume.inputBindings).toEqual([
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
  const resumeChecklist = start.missionControl.resume.checklist ?? [];
  expect(resumeChecklist.slice(0, 5).map((item) => item.kind)).toEqual([
    'run_current',
    'resolve_input',
    'resolve_input',
    'run_follow_up',
    'run_follow_up',
  ]);
  expect(resumeChecklist[0]).toEqual(
    expect.objectContaining({
      id: 'resume-ready-1',
      kind: 'run_current',
      phaseId: 'ready_now',
      stepId: 'ready-1',
      status: 'ready',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-input-1',
      kind: 'resolve_input',
      stepId: 'input-1',
      placeholder: '<symbol-from-search>',
      followUpIds: ['follow-up-1'],
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-follow-up-1',
      kind: 'run_follow_up',
      stepId: 'follow-up-1',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      blockedBy: ['input-1'],
    }),
  );
  expect(resumeChecklist).not.toContainEqual(
    expect.objectContaining({
      kind: 'run_proof',
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-proof-2',
      kind: 'run_proof',
      stepId: 'proof-2',
      command: 'projscan preflight --mode before_edit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-criterion-1',
      kind: 'confirm_done',
      stepId: 'criterion-1',
      label:
        'An exact symbol or file path is selected from search results before impact analysis continues.',
    }),
  );
  expect(start.missionControl.proofCommands[0]).toBe(
    'projscan search "auth token loader" --format json',
  );
  expect(start.missionControl.resume.remainingProofCommands).toEqual([
    'projscan preflight --mode before_edit --format json',
    'projscan understand --view verify --format json',
    'projscan preflight --format json',
  ]);
  expect(start.missionControl.resume.remainingProofToolCalls).toEqual([
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
    {
      stepId: 'proof-4',
      command: 'projscan preflight --format json',
      tool: 'projscan_preflight',
      args: {},
    },
  ]);
  expect(
    start.missionControl.resume.remainingProofToolCalls?.map((call) => call.tool),
  ).not.toContain('projscan_search');
  expect(start.missionControl.resume.followUps).toEqual([
    expect.objectContaining({
      id: 'follow-up-1',
      phaseId: 'follow_up',
      label: 'If search returns an exported symbol',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      tool: 'projscan_impact',
      args: { symbol: '<symbol-from-search>' },
      blockedBy: ['input-1'],
      dependsOn: ['ready-1', 'input-1'],
    }),
    expect.objectContaining({
      id: 'follow-up-2',
      phaseId: 'follow_up',
      label: 'If search returns a file path',
      command: 'projscan impact <file-from-search> --format json',
      tool: 'projscan_impact',
      args: { file: '<file-from-search>' },
      blockedBy: ['input-2'],
      dependsOn: ['ready-1', 'input-2'],
    }),
  ]);
});
