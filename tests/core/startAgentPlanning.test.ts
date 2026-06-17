import { expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns handoff requests into an agent brief', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computeStartReport(root, {
    intent: 'give the next agent a handoff',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_agent_brief',
      confidence: 'high',
      matchedKeywords: ['handoff', 'next', 'agent'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan agent-brief --intent next_agent --format json',
      tool: 'projscan_agent_brief',
      args: { intent: 'next_agent' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The agent brief summarizes focus items, repo context, guardrails, and suggested next actions for the next developer.',
      'The handoff includes enough proof commands for the next agent to resume without rerunning broad discovery.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan agent-brief --intent next_agent --format json',
  );
  expect(report.missionControl.resume.remainingProofCommands).toContain('projscan handoff');
  expect(
    report.missionControl.resume.remainingProofToolCalls?.map((call) => call.command),
  ).not.toContain('projscan handoff');
  expect(report.missionControl.resume.remainingProofItems?.map((item) => item.command)).toEqual(
    report.missionControl.resume.remainingProofCommands,
  );
  expect(report.missionControl.resume.remainingProofItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        stepId: 'proof-2',
        status: 'ready',
        command: 'projscan preflight --mode before_edit --format json',
        toolCall: {
          tool: 'projscan_preflight',
          args: { mode: 'before_edit' },
        },
      }),
      expect.objectContaining({
        stepId: 'proof-6',
        status: 'ready',
        label: 'projscan handoff',
        command: 'projscan handoff',
      }),
    ]),
  );
  expect(
    report.missionControl.resume.remainingProofItems?.find(
      (item) => item.command === 'projscan handoff',
    )?.toolCall,
  ).toBeUndefined();
  expect(report.missionControl.resume.checklist).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'resume-proof-2',
        kind: 'run_proof',
        command: 'projscan preflight --mode before_edit --format json',
        tool: 'projscan_preflight',
        args: { mode: 'before_edit' },
      }),
      expect.objectContaining({
        id: 'resume-proof-6',
        kind: 'run_proof',
        command: 'projscan handoff',
      }),
    ]),
  );
  const handoffChecklistProof = report.missionControl.resume.checklist?.find(
    (item) => item.id === 'resume-proof-6',
  );
  expect(handoffChecklistProof).not.toHaveProperty('tool');
  expect(handoffChecklistProof).not.toHaveProperty('args');
  expect(report.missionControl.handoff.readyProof.items).toEqual(
    report.missionControl.resume.remainingProofItems,
  );
  expect(report.missionControl.runbook.markdown).toContain('Proof queue:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-6: projscan handoff (CLI only)',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-2: `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-6: `projscan handoff` (CLI only)',
  );
});

test('start report surfaces a swarm coordination hint for coordination intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'coordinate parallel agents working the same repo',
  });

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      tool: 'projscan_coordinate',
      command: 'projscan coordinate --format json',
    }),
  );
  expect(report.coordinationHints).toContainEqual(
    expect.objectContaining({
      id: 'swarm-coordination',
      label: 'Validate swarm coordination locally',
      command: 'projscan coordinate --format json',
    }),
  );
  const hint = report.coordinationHints.find((entry) => entry.id === 'swarm-coordination');
  expect(hint?.message).toContain('collisions, claims, and merge order');
  expect(hint?.message).toContain('local worktree evidence');
});

test('start report turns open-ended next-step questions into a workplan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should I do next',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_workplan',
      confidence: 'high',
      matchedKeywords: ['do', 'next'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode before_edit --format json',
      tool: 'projscan_workplan',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.proofCommands).toContain(
    'projscan workplan --mode before_edit --format json',
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_edit --format json',
  );
});

test('start report routes build-next product-planning questions to bug-hunt workplan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should we build next',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what should we build next');
  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_workplan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['build', 'next']),
    }),
  );
  expect(report.missionControl.routedIntent?.matchedKeywords).not.toEqual(['next']);
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode bug_hunt --format json',
      tool: 'projscan_workplan',
      args: { mode: 'bug_hunt' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
      'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
    ]),
  );

  const roadmap = await computeStartReport(root, {
    intent: 'plan the product roadmap',
  });
  expect(roadmap.mode).toBe('bug_hunt');
  expect(roadmap.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode bug_hunt --format json',
      tool: 'projscan_workplan',
      args: { mode: 'bug_hunt' },
    }),
  );
  expect(roadmap.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
    ]),
  );
});

test('start report does not use bug-hunt criteria when explicit mode overrides product planning', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
    intent: 'what should we build next',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('explicit');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode before_edit --format json',
      tool: 'projscan_workplan',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.successCriteria).not.toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
      'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
    ]),
  );
});

test('start report turns session resume questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what did the last agent touch',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['touch', 'last'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Remembered touched files and recent session events are reviewed before resuming work.',
      'The current worktree preflight is rerun after session context is reviewed, so stale memory does not override live risk.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_edit --format json',
  );
});

test('start report turns leave-off questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where did I leave off',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['leave', 'off'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');
});

test('start report turns changed-while-away questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what changed while I was away',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['changed', 'away'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['changed'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');

  const offline = await computeStartReport(root, {
    intent: 'what changed while I was offline',
  });
  expect(offline.mode).toBe('before_edit');
  expect(offline.modeSource).toBe('default');
  expect(offline.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['changed', 'offline']),
    }),
  );
  expect(offline.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(
    offline.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check'),
  ).toBeUndefined();
});

test('start report turns wake-up questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what changed while I was asleep',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['changed', 'asleep'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['changed'],
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Remembered touched files and recent session events are reviewed before resuming work.',
      'The current worktree preflight is rerun after session context is reviewed, so stale memory does not override live risk.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');
});

test('start report turns last-agent status questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what did the last agent do',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['last', 'agent'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_agent_brief'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['agent'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');
});

test('start report separates current worktree context from remembered session context', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computeStartReport(root, { mode: 'before_edit', maxTasks: 2 });

  expect(report.evidence.riskSources.currentWorktree.kind).toBe('current-worktree');
  expect(report.evidence.riskSources.sessionMemory).toEqual(
    expect.objectContaining({
      kind: 'remembered-session',
      touchedFiles: expect.arrayContaining(['src/index.ts']),
      totalTouchedFiles: 1,
    }),
  );
  expect(report.coordinationHints.map((hint) => hint.id)).toContain('remembered-session-context');
  expect(report.coordinationHints.map((hint) => hint.command)).toContain(
    'projscan session touched --format json',
  );
  expect(
    report.coordinationHints.find((hint) => hint.id === 'remembered-session-context')?.message,
  ).toContain('1 touched file(s)');
});
