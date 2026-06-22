import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';
import {
  expectedReviewDecisionIds,
  expectedReviewDecisionReplies,
  expectedReviewPolicy,
  expectedReviewReplyQuotes,
} from '../helpers/startReviewGate.js';

test('start report escapes shell expansion syntax in routed freeform commands', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename $(touch /tmp/projscan-quote-pwn) auth `token` loader',
  });

  const command = report.missionControl.executionPlan.cursor.command;
  expect(command).toBe(
    'projscan search "\\$(touch /tmp/projscan-quote-pwn) auth \\`token\\` loader" --format json',
  );
  expect(command).not.toContain('"$(touch /tmp/projscan-quote-pwn)');
  expect(command).not.toContain('`token`');
  expect(report.missionControl.proofCommands[0]).toBe(command);
  expect(report.missionControl.resume.commandBlock).toBe(command);
});

test('start exposes a Mission Control task card for MCP and JSON clients', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.reviewGate).toEqual(
    expect.objectContaining({
      title: 'Mission Review Gate',
      required: true,
      status: report.missionControl.status,
      stopCondition: expect.stringContaining('Stop after'),
    }),
  );
  expect(report.missionControl.reviewGate.commands).toEqual([
    'git status --short',
    'git diff --stat',
  ]);
  expect(report.missionControl.reviewGate.policy).toEqual(expectedReviewPolicy);
  expect(report.missionControl.reviewGate.checklist).toEqual(
    expect.arrayContaining([
      'Complete this task card and remaining proof.',
      'Capture `git status --short`.',
      'Capture `git diff --stat`.',
      'Stop and ask for approval before starting another slice, release, publish, or deploy.',
    ]),
  );
  expect(report.missionControl.reviewGate.markdown).toContain('# Mission Review Gate');
  expect(report.missionControl.reviewGate.markdown).toContain('## Evidence Commands');
  expect(report.missionControl.reviewGate.worktree).toEqual(
    expect.objectContaining({
      available: false,
      clean: false,
      changedFileCount: 0,
      files: [],
      baseRef: null,
      summary: 'Current worktree evidence is unavailable: not a git repository.',
      reason: 'not a git repository',
    }),
  );
  expect(report.missionControl.reviewGate.markdown).toContain('## Worktree Evidence');
  expect(report.missionControl.reviewGate.markdown).toContain(
    'Current worktree evidence is unavailable: not a git repository.',
  );
  expect(report.missionControl.reviewGate.proof).toEqual({
    summary: report.missionControl.proofSummary,
    commands: report.missionControl.resume.remainingProofCommands,
    toolCalls: report.missionControl.resume.remainingProofToolCalls,
    items: report.missionControl.resume.remainingProofItems,
  });
  expect(report.missionControl.reviewGate.proof.commands).not.toContain(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.reviewGate.markdown).toContain('## Proof Queue');
  expect(report.missionControl.reviewGate.markdown).toContain(
    '- `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(report.missionControl.reviewGate.doneWhen).toEqual(report.missionControl.successCriteria);
  expect(report.missionControl.reviewGate.markdown).toContain('## Done When');
  expect(report.missionControl.reviewGate.markdown).toContain(
    '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(report.missionControl.reviewGate.decisions.map((decision) => decision.id)).toEqual(
    expectedReviewDecisionIds,
  );
  expect(report.missionControl.reviewGate.decisions.map((decision) => decision.reply)).toEqual(
    expectedReviewDecisionReplies,
  );
  expect(report.missionControl.reviewGate.markdown).toContain('## Reviewer Decision');
  expect(report.missionControl.reviewGate.markdown).toContain('## Review Policy');
  expect(report.missionControl.reviewGate.markdown).toContain(
    '- Start another implementation slice (`next_slice`)',
  );
  expect(report.missionControl.reviewGate.markdown).toContain('- Version bump (`version_bump`)');
  expect(report.missionControl.reviewGate.markdown).toContain(
    '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
  );
  expect(report.missionControl.reviewGate.markdown).toContain(
    'Consequence: No release, publish, deploy, or version bump is allowed unless the reviewer asks for it.',
  );
  expect(report.missionControl.reviewGate.markdown).toContain(expectedReviewReplyQuotes[0]);
  expect(report.missionControl.handoff.reviewGate).toEqual(report.missionControl.reviewGate);
  expect(report.missionControl.handoff.reviewGate.worktree).toEqual(
    report.missionControl.reviewGate.worktree,
  );
  expect(report.missionControl.handoff.reviewGate.proof).toEqual(
    report.missionControl.reviewGate.proof,
  );
  expect(report.missionControl.handoff.reviewGate.doneWhen).toEqual(
    report.missionControl.reviewGate.doneWhen,
  );
  expect(report.missionControl.handoff.reviewGate.decisions).toEqual(
    report.missionControl.reviewGate.decisions,
  );
  expect(report.missionControl.handoff.reviewGate.policy).toEqual(
    report.missionControl.reviewGate.policy,
  );
  expect(report.missionControl.taskCard).toEqual(
    expect.objectContaining({
      title: 'Mission Task Card',
      status: report.missionControl.status,
      currentPhase: report.missionControl.executionPlan.cursor.phaseId,
      currentStep: report.missionControl.executionPlan.cursor,
    }),
  );
  expect(report.missionControl.taskCard.markdown.startsWith('# Mission Task Card\n')).toBe(true);
  expect(report.missionControl.taskCard.markdown).toContain(
    'Intent: what breaks if I rename the auth token loader',
  );
  expect(report.missionControl.taskCard.markdown).toContain(
    '- [ ] Run `projscan search "auth token loader" --format json`',
  );
  expect(report.missionControl.taskCard.markdown).toContain(
    '- [ ] After inputs, run `projscan impact --symbol <symbol-from-search> --format json`',
  );
  expect(report.missionControl.taskCard.markdown).toContain('## Proof');
  expect(report.missionControl.taskCard.markdown).toContain(
    '- [ ] `projscan preflight --mode before_edit --format json`',
  );
  expect(report.missionControl.taskCard.markdown).toContain('## Done When');
  expect(report.missionControl.taskCard.markdown).toContain('## Review Gate');
  expect(report.missionControl.taskCard.markdown).toContain('## Reviewer Decision');
  expect(report.missionControl.taskCard.markdown).toContain(
    '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
  );
  expect(report.missionControl.taskCard.markdown).toContain(expectedReviewReplyQuotes[0]);
  expect(report.missionControl.taskCard.markdown).toContain(report.missionControl.handoffPrompt);
  expect(report.missionControl.runbook.markdown).toContain('## Review Gate');
  expect(report.missionControl.runbook.markdown).toContain('## Reviewer Decision');
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ ] Request changes: The agent must address review feedback before starting more scope.',
  );
  expect(report.missionControl.runbook.markdown).toContain(expectedReviewReplyQuotes[1]);
  expect(report.missionControl.taskCard.markdown.endsWith('\n')).toBe(true);
});

test('start report exposes an unblocked execution plan for direct safety-gate intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is it safe to commit this change',
  });

  expect(report.missionControl.executionPlan.summary).toBe(
    `Run 1 ready step, then gather ${report.missionControl.proofCommands.length} proof command(s).`,
  );
  expect(report.missionControl.executionPlan.currentPhase).toBe('ready_now');
  expect(report.missionControl.executionPlan.cursor).toEqual(
    expect.objectContaining({
      phaseId: 'ready_now',
      stepId: 'ready-1',
      kind: 'tool',
      status: 'ready',
      command: 'projscan assess --mode fix-first --format json',
      tool: 'projscan_assess',
      args: { mode: 'fix-first' },
      reason: 'Run this ready command next.',
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.map((phase) => `${phase.id}:${phase.status}`),
  ).toEqual(['next_action:ready', 'ready_now:ready', 'proof:ready', 'done_when:pending']);
  expect(
    report.missionControl.executionPlan.phases.some((phase) => phase.id === 'resolve_inputs'),
  ).toBe(false);
  expect(report.missionControl.executionPlan.phases[0]?.steps[0]).toEqual(
    expect.objectContaining({
      kind: 'tool',
      status: 'ready',
      command: 'projscan assess --mode fix-first --format json',
      tool: 'projscan_assess',
      args: { mode: 'fix-first' },
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'done_when')?.steps[0],
  ).toEqual(
    expect.objectContaining({
      kind: 'criterion',
      status: 'pending',
      label:
        'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
    }),
  );
  expect(report.missionControl.runbook).toEqual(
    expect.objectContaining({
      title: 'Runbook: Assess safe-commit risk first',
      status: report.missionControl.status,
      currentPhase: 'ready_now',
      readyCommandBlock: 'projscan assess --mode fix-first --format json',
    }),
  );
  expect(report.missionControl.runbook.currentPhase).toBe(
    report.missionControl.executionPlan.cursor.phaseId,
  );
  expect(report.missionControl.runbook.blockedInputSummary).toBeUndefined();
  expect(report.missionControl.runbook.markdown).toContain(
    '- `projscan assess --mode fix-first --format json`',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- `projscan preflight --mode before_commit --format json`',
  );
  expect(report.missionControl.runbook.markdown).not.toContain('## Blocked Inputs');
});
