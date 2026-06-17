import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns coordination status questions into the one-call swarm report', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'show coordination status for parallel agents',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_coordinate',
      cli: 'projscan coordinate',
      confidence: 'high',
      matchedKeywords: ['coordination', 'status', 'parallel', 'agents'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coordinate --format json',
      tool: 'projscan_coordinate',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions).toEqual([
    expect.objectContaining({
      command: 'projscan coordinate --format json',
      tool: 'projscan_coordinate',
      args: {},
    }),
  ]);
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_collision'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['coordination', 'parallel', 'agents']),
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Coordination readiness, collisions, claims, and merge order are reviewed before parallel work continues.',
      'Any conflicted files, contended claims, or merge-order blockers have an owner or follow-up command before editing resumes.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan coordinate --format json');
});

test('start report turns who-else-is-working questions into the one-call swarm report', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who else is working on this',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_coordinate',
      cli: 'projscan coordinate',
      confidence: 'high',
      matchedKeywords: ['who', 'else', 'working'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coordinate --format json',
      tool: 'projscan_coordinate',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Coordination readiness, collisions, claims, and merge order are reviewed before parallel work continues.',
      'Any conflicted files, contended claims, or merge-order blockers have an owner or follow-up command before editing resumes.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan coordinate --format json');
});

test('start report turns collision shorthand into the one-call swarm report', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'am I going to collide with another agent',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_coordinate',
      cli: 'projscan coordinate',
      confidence: 'high',
      matchedKeywords: ['agent', 'collide'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coordinate --format json',
      tool: 'projscan_coordinate',
      args: {},
    }),
  );
});

test('start report turns merge-order shorthand into merge-risk', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should merge first',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_merge_risk',
      cli: 'projscan merge-risk',
      confidence: 'high',
      matchedKeywords: ['merge', 'first'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan merge-risk --format json',
      tool: 'projscan_merge_risk',
      args: {},
    }),
  );
});

test('start report turns file claim requests into a safe claim action plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'claim src/core/start.ts for me',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_claim',
      cli: 'projscan claim',
      confidence: 'high',
      matchedKeywords: ['claim'],
    }),
  );
  expect(report.missionControl.actionPlan).toEqual([
    expect.objectContaining({
      label: 'Review active claims before adding a file claim',
      command: 'projscan claim list --format json',
      tool: 'projscan_claim',
      args: { action: 'list' },
    }),
    expect.objectContaining({
      label: 'Add claim for src/core/start.ts',
      command: 'projscan claim add src/core/start.ts --agent <agent-name>',
      tool: 'projscan_claim',
      args: { action: 'add', target: 'src/core/start.ts', agent: '<agent-name>' },
    }),
  ]);
  expect(report.missionControl.readyActions).toEqual([
    expect.objectContaining({
      command: 'projscan claim list --format json',
      tool: 'projscan_claim',
      args: { action: 'list' },
    }),
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([
    {
      name: 'agent',
      placeholder: '<agent-name>',
      sourceAction: 'Review active claims before adding a file claim',
      instruction: 'Replace <agent-name> with the agent name holding the claim.',
    },
  ]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Active claims are reviewed before a new file, directory, or symbol claim is added.',
      'The target is claimed with a real agent name, and any returned contention is assigned or resolved before parallel editing continues.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan claim list --format json');
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan claim add src/core/start.ts --agent <agent-name>',
  );
  expect(report.missionControl.handoffPrompt).toContain('Needs input: agent=<agent-name>.');
  expect(report.missionControl.handoffPrompt).not.toContain(
    'projscan claim add src/auth.ts --agent me',
  );
});

test('start report makes explicit claim-agent requests immediately runnable', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'claim src/core/start.ts as agent-alpha',
  });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_claim',
      cli: 'projscan claim',
      confidence: 'high',
      matchedKeywords: ['claim'],
    }),
  );
  expect(report.missionControl.actionPlan).toEqual([
    expect.objectContaining({
      label: 'Add claim for src/core/start.ts',
      command: 'projscan claim add src/core/start.ts --agent agent-alpha',
      tool: 'projscan_claim',
      args: { action: 'add', target: 'src/core/start.ts', agent: 'agent-alpha' },
    }),
  ]);
  expect(report.missionControl.readyActions[0]).toEqual(
    expect.objectContaining({
      command: 'projscan claim add src/core/start.ts --agent agent-alpha',
      tool: 'projscan_claim',
      args: { action: 'add', target: 'src/core/start.ts', agent: 'agent-alpha' },
    }),
  );
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.proofCommands).toContain(
    'projscan claim add src/core/start.ts --agent agent-alpha',
  );
});

test('start report turns active-claims questions into claim listing', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'show active claims',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_claim',
      cli: 'projscan claim',
      confidence: 'high',
      matchedKeywords: ['claims', 'active'],
    }),
  );
  expect(report.missionControl.actionPlan).toEqual([
    expect.objectContaining({
      label: 'Review active claims',
      command: 'projscan claim list --format json',
      tool: 'projscan_claim',
      args: { action: 'list' },
    }),
  ]);
  expect(report.missionControl.readyActions[0]).toEqual(
    expect.objectContaining({
      command: 'projscan claim list --format json',
      tool: 'projscan_claim',
      args: { action: 'list' },
    }),
  );
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Active claims, owners, leases, and contention warnings are reviewed before parallel work continues.',
      'Any stale or contended claim has a release, owner, or coordination follow-up before editing resumes.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan claim list --format json');
});

