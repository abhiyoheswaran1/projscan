import { beforeEach, expect, test } from 'vitest';
import { makeTempProject } from '../helpers/startProject.js';
import { runFuzzyImpactStart, expectedReviewDecisionReplies } from './startFuzzyImpactHelper.js';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempProject();
});

test('projscan_start exposes fuzzy-impact review gates and runbook details', async () => {
  const start = await runFuzzyImpactStart(tmp);

  expect(start.missionControl.reviewGate).toEqual(
    expect.objectContaining({
      title: 'Mission Review Gate',
      required: true,
      commands: ['git status --short', 'git diff --stat'],
    }),
  );
  expect(start.missionControl.reviewGate.policy).toEqual({
    approvalRequired: true,
    blockedActions: ['next_slice', 'release', 'publish', 'deploy', 'push', 'merge', 'version_bump'],
    summary:
      'Explicit reviewer approval is required before another slice, release, publish, deploy, push, merge, or version bump.',
  });
  expect(start.missionControl.reviewGate.markdown).toContain('# Mission Review Gate');
  expect(start.missionControl.reviewGate.markdown).toContain('## Review Policy');
  expect(start.missionControl.reviewGate.markdown).toContain(
    'Stop and ask for approval before starting another slice, release, publish, or deploy.',
  );
  expect(start.missionControl.reviewGate.worktree.summary).toContain(
    'Current worktree evidence',
  );
  expect(start.missionControl.reviewGate.proof.commands).toEqual(
    start.missionControl.resume.remainingProofCommands,
  );
  expect(start.missionControl.reviewGate.proof.toolCalls).toEqual(
    start.missionControl.resume.remainingProofToolCalls,
  );
  expect(start.missionControl.reviewGate.proof.items).toEqual(
    start.missionControl.resume.remainingProofItems,
  );
  expect(start.missionControl.reviewGate.markdown).toContain('## Proof Queue');
  expect(start.missionControl.reviewGate.doneWhen).toEqual(
    start.missionControl.successCriteria,
  );
  expect(start.missionControl.reviewGate.markdown).toContain('## Done When');
  expect(start.missionControl.reviewGate.decisions.map((decision) => decision.id)).toEqual([
    'approve_next_slice',
    'request_changes',
    'review_version_candidate',
  ]);
  expect(
    start.missionControl.reviewGate.decisions.map((decision) => decision.reply),
  ).toEqual(expectedReviewDecisionReplies);
  expect(start.missionControl.reviewGate.markdown).toContain('## Reviewer Decision');
  expect(start.missionControl.reviewGate.markdown).toContain(
    'Reply: "Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version."',
  );
  expect(start.missionControl.handoff.reviewGate).toEqual(
    start.missionControl.reviewGate,
  );
  expect(start.missionControl.handoff.reviewGate.worktree).toEqual(
    start.missionControl.reviewGate.worktree,
  );
  expect(start.missionControl.handoff.reviewGate.proof).toEqual(
    start.missionControl.reviewGate.proof,
  );
  expect(start.missionControl.handoff.reviewGate.doneWhen).toEqual(
    start.missionControl.reviewGate.doneWhen,
  );
  expect(start.missionControl.handoff.reviewGate.decisions).toEqual(
    start.missionControl.reviewGate.decisions,
  );
  expect(start.missionControl.handoff.reviewGate.policy).toEqual(
    start.missionControl.reviewGate.policy,
  );
  expect(start.missionControl.executionPlan.summary).toBe(
    `Run 1 ready step, resolve 2 input(s), then gather ${start.missionControl.proofCommands.length} proof command(s).`,
  );
  expect(start.missionControl.executionPlan.currentPhase).toBe('ready_now');
  expect(start.missionControl.executionPlan.cursor).toEqual(
    expect.objectContaining({
      phaseId: 'ready_now',
      stepId: 'ready-1',
      kind: 'tool',
      status: 'ready',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      unlocks: ['input-1', 'input-2'],
      reason: 'Run this ready command next; it can unlock later inputs or follow-up steps.',
    }),
  );
  expect(
    start.missionControl.executionPlan.phases.map((phase) => `${phase.id}:${phase.status}`),
  ).toEqual([
    'next_action:ready',
    'ready_now:ready',
    'resolve_inputs:blocked',
    'follow_up:pending',
    'proof:ready',
    'done_when:pending',
  ]);
  expect(start.missionControl.executionPlan.phases[0]?.steps[0]).toEqual(
    expect.objectContaining({
      kind: 'tool',
      status: 'ready',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(
    start.missionControl.executionPlan.phases.find((phase) => phase.id === 'resolve_inputs')
      ?.steps[0],
  ).toEqual(
    expect.objectContaining({
      kind: 'input',
      status: 'blocked',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
  );
  expect(
    start.missionControl.executionPlan.phases.find((phase) => phase.id === 'ready_now')
      ?.steps[0],
  ).toEqual(
    expect.objectContaining({
      id: 'ready-1',
      unlocks: ['input-1', 'input-2'],
    }),
  );
  expect(
    start.missionControl.executionPlan.phases.find((phase) => phase.id === 'follow_up')
      ?.steps[0],
  ).toEqual(
    expect.objectContaining({
      id: 'follow-up-1',
      dependsOn: ['ready-1', 'input-1'],
      blockedBy: ['input-1'],
    }),
  );
  expect(start.missionControl.runbook).toEqual(
    expect.objectContaining({
      title: 'Runbook: Find exact target for impact analysis',
      currentPhase: 'ready_now',
      currentStep: start.missionControl.executionPlan.cursor,
      resume: start.missionControl.resume,
      readyCommandBlock: 'projscan search "auth token loader" --format json',
      blockedInputSummary: 'Needs input: symbol=<symbol-from-search>, file=<file-from-search>.',
    }),
  );
  expect(start.missionControl.runbook.currentPhase).toBe(
    start.missionControl.executionPlan.cursor.phaseId,
  );
  expect(start.missionControl.runbook.readyCommandBlock).not.toContain('<');
  expect(start.missionControl.runbook.markdown).toContain('## Current Cursor');
  expect(start.missionControl.runbook.markdown).toContain('- Step: ready-1 in ready_now');
  expect(start.missionControl.runbook.markdown).toContain(
    '- MCP call: projscan_search {"query":"auth token loader"}',
  );
  expect(start.missionControl.runbook.markdown).toContain('- Unlocks: input-1, input-2');
  expect(start.missionControl.runbook.markdown).toContain('## Resume');
  expect(start.missionControl.runbook.markdown).toContain(
    '```sh\nprojscan search "auth token loader" --format json\n```',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    'MCP call: projscan_search {"query":"auth token loader"}',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- input-2 (file): Replace <file-from-search> with a file path returned by the search step.',
  );
  expect(start.missionControl.runbook.markdown).toContain('Template inputs:');
  expect(start.missionControl.runbook.markdown).toContain(
    '- <symbol-from-search> -> input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- <file-from-search> -> input-2 (file): Replace <file-from-search> with a file path returned by the search step.',
  );
  expect(start.missionControl.runbook.markdown).toContain('Resume checklist:');
  expect(start.missionControl.runbook.markdown).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(start.missionControl.runbook.markdown).toContain('Remaining proof:');
  expect(start.missionControl.runbook.markdown).not.toContain(
    'Remaining proof:\n- `projscan search "auth token loader" --format json`',
  );
  expect(start.missionControl.runbook.markdown).toContain('MCP proof calls:');
  expect(start.missionControl.runbook.markdown).toContain(
    '- proof-2: projscan_preflight {"mode":"before_edit"}',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- proof-3: projscan_understand {"view":"verify"}',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- follow-up-1 (If search returns an exported symbol): projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    '- follow-up-2 (If search returns a file path): projscan impact <file-from-search> --format json',
  );
  expect(start.missionControl.runbook.markdown).toContain('## Handoff Prompt');
  expect(start.missionControl.runbook.markdown).toContain('## Reviewer Decision');
  expect(start.missionControl.runbook.markdown).toContain(
    '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    'Reply: "Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version."',
  );
  expect(start.missionControl.runbook.markdown).toContain(
    start.missionControl.handoffPrompt,
  );
  expect(start.missionControl.runbook.markdown).toContain('## Ready Commands');
  expect(start.missionControl.runbook.markdown).toContain(
    '- `projscan search "auth token loader" --format json`',
  );
  expect(start.missionControl.runbook.markdown).toContain('## Blocked Inputs');
});
