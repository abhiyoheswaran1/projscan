import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';
import { expectedReviewPromptReplies } from '../helpers/startReviewGate.js';

test('start report exposes a phased execution plan for fuzzy routed intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.executionPlan.summary).toBe(
    `Run 1 ready step, resolve 2 input(s), then gather ${report.missionControl.proofCommands.length} proof command(s).`,
  );
  expect(report.missionControl.executionPlan.currentPhase).toBe('ready_now');
  expect(report.missionControl.executionPlan.cursor).toEqual(
    expect.objectContaining({
      phaseId: 'ready_now',
      stepId: 'ready-1',
      kind: 'tool',
      status: 'ready',
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      unlocks: ['input-1', 'input-2'],
      reason: 'Run this ready command next; it can unlock later inputs or follow-up steps.',
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.map((phase) => `${phase.id}:${phase.status}`),
  ).toEqual([
    'next_action:ready',
    'ready_now:ready',
    'resolve_inputs:blocked',
    'follow_up:pending',
    'proof:ready',
    'done_when:pending',
  ]);
  expect(report.missionControl.executionPlan.phases[0]?.steps[0]).toEqual(
    expect.objectContaining({
      id: 'next-action-1',
      kind: 'tool',
      status: 'ready',
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'ready_now')?.steps[0],
  ).toEqual(
    expect.objectContaining({
      id: 'ready-1',
      unlocks: ['input-1', 'input-2'],
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'resolve_inputs')
      ?.steps,
  ).toEqual([
    expect.objectContaining({
      id: 'input-1',
      kind: 'input',
      status: 'blocked',
      label: 'symbol',
      dependsOn: ['ready-1'],
      unlocks: ['follow-up-1'],
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
    expect.objectContaining({
      id: 'input-2',
      kind: 'input',
      status: 'blocked',
      label: 'file',
      dependsOn: ['ready-1'],
      unlocks: ['follow-up-2'],
      placeholder: '<file-from-search>',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    }),
  ]);
  expect(
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'follow_up')?.steps,
  ).toEqual([
    expect.objectContaining({
      id: 'follow-up-1',
      kind: 'tool',
      status: 'blocked',
      dependsOn: ['ready-1', 'input-1'],
      blockedBy: ['input-1'],
      command: 'projscan impact --symbol <symbol-from-search> --format json',
    }),
    expect.objectContaining({
      id: 'follow-up-2',
      kind: 'tool',
      status: 'blocked',
      dependsOn: ['ready-1', 'input-2'],
      blockedBy: ['input-2'],
      command: 'projscan impact <file-from-search> --format json',
    }),
  ]);
  const proofSteps =
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'proof')?.steps ?? [];
  expect(proofSteps.map((step) => step.command)).toEqual(report.missionControl.proofCommands);
  expect(proofSteps[0]).toEqual(
    expect.objectContaining({
      id: 'proof-1',
      kind: 'proof',
      status: 'ready',
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(proofSteps[1]).toEqual(
    expect.objectContaining({
      id: 'proof-2',
      kind: 'proof',
      status: 'ready',
      command: 'projscan preflight --mode before_edit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.resume).toEqual(
    expect.objectContaining({
      currentStep: report.missionControl.executionPlan.cursor,
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
  expect(report.missionControl.resume.unlocks).toEqual([
    expect.objectContaining({
      id: 'input-1',
      phaseId: 'resolve_inputs',
      kind: 'input',
      status: 'blocked',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
    expect.objectContaining({
      id: 'input-2',
      phaseId: 'resolve_inputs',
      kind: 'input',
      status: 'blocked',
      label: 'file',
      placeholder: '<file-from-search>',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    }),
  ]);
  expect(report.missionControl.resume.inputBindings).toEqual([
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
  const resumeChecklist = report.missionControl.resume.checklist ?? [];
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
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      unlocks: ['input-1', 'input-2'],
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-input-1',
      kind: 'resolve_input',
      phaseId: 'resolve_inputs',
      stepId: 'input-1',
      status: 'blocked',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
      followUpIds: ['follow-up-1'],
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-follow-up-1',
      kind: 'run_follow_up',
      phaseId: 'follow_up',
      stepId: 'follow-up-1',
      status: 'blocked',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      tool: 'projscan_impact',
      args: { symbol: '<symbol-from-search>' },
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
      phaseId: 'proof',
      stepId: 'proof-2',
      status: 'ready',
      command: 'projscan preflight --mode before_edit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-criterion-1',
      kind: 'confirm_done',
      phaseId: 'done_when',
      stepId: 'criterion-1',
      status: 'pending',
      label:
        'An exact symbol or file path is selected from search results before impact analysis continues.',
    }),
  );
  expect(report.missionControl.proofCommands[0]).toBe(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.resume.remainingProofCommands).toEqual([
    'projscan preflight --mode before_edit --format json',
    'projscan understand --view verify --format json',
    'projscan preflight --format json',
  ]);
  expect(report.missionControl.resume.remainingProofToolCalls).toEqual([
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
    report.missionControl.resume.remainingProofToolCalls?.map((call) => call.tool),
  ).not.toContain('projscan_search');
  expect(report.missionControl.resume.followUps).toEqual([
    expect.objectContaining({
      id: 'follow-up-1',
      phaseId: 'follow_up',
      kind: 'tool',
      status: 'blocked',
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
      kind: 'tool',
      status: 'blocked',
      label: 'If search returns a file path',
      command: 'projscan impact <file-from-search> --format json',
      tool: 'projscan_impact',
      args: { file: '<file-from-search>' },
      blockedBy: ['input-2'],
      dependsOn: ['ready-1', 'input-2'],
    }),
  ]);
  expect(report.missionControl.handoffPrompt).toContain(report.missionControl.resume.prompt);
  expect(report.missionControl.handoffPrompt).toContain('input-1 (symbol), input-2 (file)');
  expect(report.missionControl.handoffPrompt.startsWith('Resume: ')).toBe(true);
  expect(report.missionControl.handoffPrompt).toContain(
    'Review gate: Stop after the current Mission Control checklist and proof are complete.',
  );
  expect(report.missionControl.handoffPrompt).toContain(expectedReviewPromptReplies[0]);
  const handoffReadyProof = report.missionControl.handoffPrompt.split('Ready proof: ')[1] ?? '';
  expect(handoffReadyProof).not.toContain('projscan search "auth token loader" --format json');
  expect(handoffReadyProof).toContain('projscan preflight --mode before_edit --format json');
  expect(report.missionControl.handoff.currentStep).toEqual(
    report.missionControl.executionPlan.cursor,
  );
  expect(report.missionControl.handoff.resume).toEqual(report.missionControl.resume);
  expect(report.missionControl.handoff.readyProof.commands).toEqual(
    report.missionControl.resume.remainingProofCommands,
  );
  expect(report.missionControl.handoff.readyProof.commands).not.toContain(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.handoff.readyProof.toolCalls).toEqual(
    report.missionControl.resume.remainingProofToolCalls,
  );
  expect(
    report.missionControl.handoff.readyProof.toolCalls?.map((call) => call.tool),
  ).not.toContain('projscan_search');
  expect(report.missionControl.runbook).toEqual(
    expect.objectContaining({
      title: 'Runbook: Find exact target for impact analysis',
      status: report.missionControl.status,
      currentPhase: 'ready_now',
      currentStep: report.missionControl.executionPlan.cursor,
      resume: report.missionControl.resume,
      readyCommandBlock: 'projscan search "auth token loader" --format json',
      blockedInputSummary: 'Needs input: symbol=<symbol-from-search>, file=<file-from-search>.',
    }),
  );
  expect(report.missionControl.runbook.currentPhase).toBe(
    report.missionControl.executionPlan.cursor.phaseId,
  );
  expect(report.missionControl.runbook.readyCommandBlock).not.toContain('<');
  expect(report.missionControl.runbook.markdown).toContain('# Mission Runbook');
  expect(report.missionControl.runbook.markdown).toContain(
    'Intent: what breaks if I rename the auth token loader',
  );
  expect(report.missionControl.runbook.markdown).toContain('## Current Cursor');
  expect(report.missionControl.runbook.markdown).toContain('- Step: ready-1 in ready_now');
  expect(report.missionControl.runbook.markdown).toContain(
    '- Command: `projscan search "auth token loader" --format json`',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- MCP call: projscan_search {"query":"auth token loader"}',
  );
  expect(report.missionControl.runbook.markdown).toContain('- Unlocks: input-1, input-2');
  expect(report.missionControl.runbook.markdown).toContain(
    '- Why: Run this ready command next; it can unlock later inputs or follow-up steps.',
  );
  expect(report.missionControl.runbook.markdown).toContain('## Resume');
  expect(report.missionControl.runbook.markdown).toContain('Run now:');
  expect(report.missionControl.runbook.markdown).toContain(
    '```sh\nprojscan search "auth token loader" --format json\n```',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    'MCP call: projscan_search {"query":"auth token loader"}',
  );
  expect(report.missionControl.runbook.markdown).toContain('After running, resolve:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- input-2 (file): Replace <file-from-search> with a file path returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain('Template inputs:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- <symbol-from-search> -> input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- <file-from-search> -> input-2 (file): Replace <file-from-search> with a file path returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain('Resume checklist:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [pending] confirm_done criterion-1: An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(report.missionControl.runbook.markdown).toContain('Remaining proof:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- `projscan preflight --mode before_edit --format json`',
  );
  expect(report.missionControl.runbook.markdown).not.toContain(
    'Remaining proof:\n- `projscan search "auth token loader" --format json`',
  );
  expect(report.missionControl.runbook.markdown).toContain('MCP proof calls:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-2: projscan_preflight {"mode":"before_edit"}',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-3: projscan_understand {"view":"verify"}',
  );
  expect(report.missionControl.runbook.markdown).toContain('Then use:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- follow-up-1 (If search returns an exported symbol): projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- follow-up-2 (If search returns a file path): projscan impact <file-from-search> --format json',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    'Prompt: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
  );
  expect(report.missionControl.runbook.markdown).toContain('## Handoff Prompt');
  expect(report.missionControl.runbook.markdown).toContain(report.missionControl.handoffPrompt);
  expect(report.missionControl.runbook.markdown.indexOf('## Resume')).toBeLessThan(
    report.missionControl.runbook.markdown.indexOf('## Handoff Prompt'),
  );
  expect(report.missionControl.runbook.markdown.indexOf('## Handoff Prompt')).toBeLessThan(
    report.missionControl.runbook.markdown.indexOf('## Ready Commands'),
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- `projscan search "auth token loader" --format json`',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- An exact symbol or file path is selected from search results before impact analysis continues.',
  );
});
