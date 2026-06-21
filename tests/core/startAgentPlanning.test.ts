import { expect, test } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
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

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
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
  expect(report.missionControl.resume.remainingProofCommands).toContain(
    'projscan preflight --mode before_commit --format json',
  );
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
        command: 'projscan preflight --mode before_commit --format json',
        toolCall: {
          tool: 'projscan_preflight',
          args: { mode: 'before_commit' },
        },
      }),
      expect.objectContaining({
        stepId: 'proof-4',
        status: 'ready',
        label: 'projscan session touched --format json',
        command: 'projscan session touched --format json',
        toolCall: {
          tool: 'projscan_session',
          args: { action: 'touched' },
        },
      }),
    ]),
  );
  expect(report.missionControl.resume.remainingProofCommands).not.toContain('projscan handoff');
  expect(report.missionControl.resume.checklist).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'resume-proof-2',
        kind: 'run_proof',
        command: 'projscan preflight --mode before_commit --format json',
        tool: 'projscan_preflight',
        args: { mode: 'before_commit' },
      }),
      expect.objectContaining({
        id: 'resume-proof-4',
        kind: 'run_proof',
        command: 'projscan session touched --format json',
        tool: 'projscan_session',
        args: { action: 'touched' },
      }),
    ]),
  );
  const sessionChecklistProof = report.missionControl.resume.checklist?.find(
    (item) => item.id === 'resume-proof-4',
  );
  expect(sessionChecklistProof).toHaveProperty('tool', 'projscan_session');
  expect(sessionChecklistProof).toHaveProperty('args', { action: 'touched' });
  expect(report.missionControl.handoff.readyProof.items).toEqual(
    report.missionControl.resume.remainingProofItems,
  );
  expect(report.missionControl.runbook.markdown).toContain('Proof queue:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-4: projscan session touched --format json (MCP: projscan_session {"action":"touched"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-2: `projscan preflight --mode before_commit --format json` (MCP: projscan_preflight {"mode":"before_commit"})',
  );
  expect(report.missionControl.runbook.markdown).not.toContain('projscan handoff');
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
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toBe(
    'Intent "what should I do next" maps to the before_edit workflow.',
  );
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

test('start report routes change-prep read questions to understand change view', async () => {
  const root = await makeTempProject();
  const intent = 'what files should I read before adding auth token refresh';

  const report = await computeStartReport(root, { intent });

  expect(report.mode).toBe('before_edit');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view change --intent "what files should I read before adding auth token refresh" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent },
    }),
  );

  const setup = await computeStartReport(root, {
    intent: 'how do I install projscan and set up MCP',
  });
  expect(setup.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
});

test('start report routes generic build-next questions to before-edit workplans', async () => {
  const root = await makeTempProject();
  await fs.writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version: '4.6.0', type: 'module' }, null, 2)}\n`,
  );

  const report = await computeStartReport(root, {
    intent: 'what should we build next',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toBe(
    'Intent "what should we build next" maps to the before_edit workflow.',
  );
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_workplan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['build', 'next']),
    }),
  );
  expect(report.missionControl.routedIntent?.matchedKeywords).not.toEqual(['next']);
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode before_edit --format json',
      tool: 'projscan_workplan',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.evidence.roadmapPreview).toBeUndefined();

  const roadmap = await computeStartReport(root, {
    intent: 'plan the product roadmap',
  });
  expect(roadmap.mode).toBe('release');
  expect(roadmap.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan release-train --format json',
      tool: 'projscan_release_train',
      args: {},
    }),
  );
  expect(roadmap.evidence.roadmapPreview).toEqual(
    expect.objectContaining({
      readOnly: true,
      lines: ['4.5.x', '4.6.x', '4.7.x', '4.8.x', '4.9.x'],
    }),
  );
  expect(roadmap.evidence.roadmapPreview?.workstreams.map((entry) => entry.id)).toContain(
    'rt-4-6-swarm-coordination-validation',
  );

  const bugHunt = await computeStartReport(root, {
    intent: 'find bugs to fix before the PR',
  });
  expect(bugHunt.mode).toBe('bug_hunt');
  expect(bugHunt.missionControl.primaryAction?.tool).toBe('projscan_bug_hunt');
});

test('start report uses release-candidate proof mode without release automation', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'prepare a release candidate review without publishing',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.recommendedWorkflow.id).toBe('pre_merge');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_evidence_pack',
      confidence: 'high',
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.primaryAction.command).not.toMatch(/publish|version|tag|push/);
  expect(report.missionControl.successCriteria).toContain(
    'The next task has a verification command: projscan preflight --mode before_merge --format json',
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_merge --format json',
  );
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan preflight --mode before_commit --format json',
  );
});

test('start report routes improve-next trust prompts to planning instead of privacy check', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should we improve next to make engineers trust this daily',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_bug_hunt',
      confidence: 'high',
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
  expect(report.missionControl.guardrails.map((guardrail) => guardrail.command)).toContain(
    'projscan preflight --mode before_edit --format json',
  );
  expect(report.firstTenMinutes.commands[0].command).toBe('projscan privacy-check --offline');
});

test('start report routes product-improvement trust workflow prompts to bug hunt', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'make projscan more useful for engineers by reducing noisy or slow trust workflows',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_bug_hunt',
      confidence: 'high',
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
    }),
  );
  expect((report.missionControl.alternatives ?? []).map((route) => route.tool)).not.toContain(
    'projscan_regression_plan',
  );
});

test('start report fills feedback intake commands with the raw intent text', async () => {
  const root = await makeTempProject();
  const intent =
    'npm install -g projscan got allow-scripts warnings from tree-sitter-c-sharp node-gyp-build';

  const report = await computeStartReport(root, { intent });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_feedback_intake',
      confidence: 'high',
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan feedback intake --text "npm install -g projscan got allow-scripts warnings from tree-sitter-c-sharp node-gyp-build" --format json',
      tool: 'projscan_feedback_intake',
      args: { text: intent },
    }),
  );
  expect(report.missionControl.primaryAction.command).not.toContain('<feedback>');
});

test('start report keeps ordinary install setup prompts on understand', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how do I install projscan and set up MCP',
  });

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
    }),
  );
});

test('start report uses feedback-intake success criteria for noisy caution feedback', async () => {
  const root = await makeTempProject();
  const intent = 'caution output is becoming noisy background noise in every PR';

  const report = await computeStartReport(root, { intent });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_feedback_intake',
      confidence: 'high',
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan feedback intake --text "caution output is becoming noisy background noise in every PR" --format json',
      tool: 'projscan_feedback_intake',
      args: { text: intent },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual([
    'The raw feedback is classified and preserved before any product change starts.',
    'The generated AgentLoop task command is copied or run so the feedback becomes a bounded implementation slice.',
    'The feedback-intake suggested verification command is attached to the task or handoff.',
    'The next task has a verification command: projscan preflight --mode before_edit --format json',
  ]);
});

test('start report routes docs-overclaim feedback to feedback intake', async () => {
  const root = await makeTempProject();
  const intent = 'docs sound bigger than demonstrated workflows';

  const report = await computeStartReport(root, { intent });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_feedback_intake',
      confidence: 'high',
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan feedback intake --text "docs sound bigger than demonstrated workflows" --format json',
      tool: 'projscan_feedback_intake',
      args: { text: intent },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The raw feedback is classified and preserved before any product change starts.',
      'The generated AgentLoop task command is copied or run so the feedback becomes a bounded implementation slice.',
    ]),
  );
});

test('start report routes workflow-focus feedback to feedback intake', async () => {
  const root = await makeTempProject();
  const intent = 'feature breadth without a few killer workflows that engineers trust daily';

  const report = await computeStartReport(root, { intent });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_feedback_intake',
      confidence: 'high',
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan feedback intake --text "feature breadth without a few killer workflows that engineers trust daily" --format json',
      tool: 'projscan_feedback_intake',
      args: { text: intent },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The raw feedback is classified and preserved before any product change starts.',
      'The generated AgentLoop task command is copied or run so the feedback becomes a bounded implementation slice.',
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
