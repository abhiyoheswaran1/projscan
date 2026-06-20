import { describe, expect, test } from 'vitest';
import { buildMissionControl } from '../../src/core/startMissionControl.js';
import type { StartReport, StartWorkflowRecommendation, WorkplanReport } from '../../src/types.js';

const workplan: WorkplanReport = {
  schemaVersion: 1,
  mode: 'before_edit',
  verdict: 'proceed',
  summary: 'ready to inspect impact',
  topRisks: [],
  tasks: [],
  coordination: {
    touchedFiles: [],
    conflicts: [],
    recommendedNextAgent: 'codex',
  },
  suggestedNextActions: [],
};

const workflow: StartWorkflowRecommendation = {
  id: 'before_edit',
  name: 'Before edit',
  why: 'Inspect before editing.',
  commands: ['projscan preflight --mode before_edit --format json'],
  mcpTools: ['projscan_preflight'],
};

const riskSources: StartReport['evidence']['riskSources'] = {
  currentWorktree: {
    kind: 'current-worktree',
    available: true,
    count: 0,
    files: [],
    baseRef: 'main',
    branchChangedFileCount: 0,
    uncommittedChangedFileCount: 0,
    uncommittedFiles: [],
  },
  sessionMemory: {
    kind: 'remembered-session',
    touchedFiles: [],
    totalTouchedFiles: 0,
    note: 'No remembered touches.',
  },
};

describe('start mission control builder', () => {
  test('builds routed mission control with handoff and review gate wiring', () => {
    const mission = buildMissionControl({
      mode: 'before_edit',
      intent: 'what breaks if I rename the auth token loader',
      setupOverall: 'pass',
      workplan,
      workflow,
      adoptionGaps: [],
      coordinationHints: [],
      riskSources,
    });

    expect(buildMissionControl).toBeTypeOf('function');
    expect(mission.status).toBe('ready');
    expect(mission.routedIntent?.tool).toBe('projscan_impact');
    expect(mission.primaryAction.tool).toBe('projscan_search');
    expect(mission.primaryAction.command).toBe('projscan search "auth token loader" --format json');
    expect(mission.actionPlan.map((action) => action.tool)).toEqual([
      'projscan_search',
      'projscan_impact',
      'projscan_impact',
    ]);
    expect(mission.unresolvedInputs.map((input) => input.placeholder)).toEqual([
      '<symbol-from-search>',
      '<file-from-search>',
    ]);
    expect(mission.successCriteria).toContain(
      'An exact symbol or file path is selected from search results before impact analysis continues.',
    );
    expect(mission.handoff.currentStep).toEqual(mission.executionPlan.cursor);
    expect(mission.handoff.reviewGate).toEqual(mission.reviewGate);
    expect(mission.reviewGate.doneWhen).toEqual(mission.successCriteria);
    expect(mission.handoffPrompt).toContain(mission.resume.prompt);
    expect(mission.taskCard.markdown).toContain(mission.handoffPrompt);
    expect(mission.runbook.markdown).toContain(mission.handoffPrompt);
  });

  test('review gate treats clean working tree and ahead-of-base diff as separate evidence', () => {
    const mission = buildMissionControl({
      mode: 'before_edit',
      intent: 'continue local implementation',
      setupOverall: 'pass',
      workplan,
      workflow,
      adoptionGaps: [],
      coordinationHints: [],
      riskSources: {
        ...riskSources,
        currentWorktree: {
          kind: 'current-worktree',
          available: true,
          count: 2,
          files: ['src/a.ts', 'src/b.ts'],
          baseRef: 'origin/main',
          branchChangedFileCount: 2,
          uncommittedChangedFileCount: 0,
          uncommittedFiles: [],
        },
      },
    });

    expect(mission.reviewGate.worktree).toEqual(
      expect.objectContaining({
        clean: true,
        changedFileCount: 2,
        branchChangedFileCount: 2,
        uncommittedChangedFileCount: 0,
        summary:
          'Working tree has no uncommitted changes; branch differs from origin/main by 2 file(s).',
      }),
    );
    expect(mission.reviewGate.markdown).toContain(
      'Working tree has no uncommitted changes; branch differs from origin/main by 2 file(s).',
    );
  });

  test('review gate marks dirty working tree separately from committed branch diff', () => {
    const mission = buildMissionControl({
      mode: 'before_edit',
      intent: 'continue local implementation',
      setupOverall: 'pass',
      workplan,
      workflow,
      adoptionGaps: [],
      coordinationHints: [],
      riskSources: {
        ...riskSources,
        currentWorktree: {
          kind: 'current-worktree',
          available: true,
          count: 3,
          files: ['src/a.ts', 'src/b.ts', 'src/wip.ts'],
          baseRef: 'origin/main',
          branchChangedFileCount: 2,
          uncommittedChangedFileCount: 1,
          uncommittedFiles: ['src/wip.ts'],
        },
      },
    });

    expect(mission.reviewGate.worktree).toEqual(
      expect.objectContaining({
        clean: false,
        changedFileCount: 3,
        branchChangedFileCount: 2,
        uncommittedChangedFileCount: 1,
        summary:
          'Working tree has 1 uncommitted changed file(s); branch differs from origin/main by 2 committed file(s).',
      }),
    );
  });
});
