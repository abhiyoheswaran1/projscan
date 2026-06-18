import { describe, expect, test } from 'vitest';
import {
  chooseWorkflow,
  combineRisks,
  headlineForStatus,
  missionActionPlan,
  missionGuardrails,
  missionProofCommands,
  missionReadyActions,
  missionStatus,
  missionUnresolvedInputs,
  routedWhyNow,
  summarize,
} from '../../src/core/startMissionPolicy.js';
import type { AgentWorkflowRecipe } from '../../src/core/adoption.js';
import type {
  PreflightSuggestedAction,
  QualityScorecardRisk,
  StartAdoptionGap,
  StartRoutedIntent,
  StartWorkflowRecommendation,
  WorkplanReport,
} from '../../src/types.js';

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

function route(tool: string, overrides: Partial<StartRoutedIntent> = {}): StartRoutedIntent {
  return {
    intent: `Test intent for ${tool}`,
    category: 'Test',
    tool,
    cli: tool.replace(/^projscan_/, 'projscan '),
    why: 'Route fixture',
    example: `${tool} example`,
    confidence: 'high',
    rank: 1,
    score: 10,
    matchedKeywords: [],
    ...overrides,
  };
}

function workplan(overrides: Partial<WorkplanReport> = {}): WorkplanReport {
  return {
    schemaVersion: 1,
    mode: 'before_edit',
    verdict: 'proceed',
    summary: 'Workplan fixture',
    topRisks: [
      {
        priority: 'p1',
        source: 'verification',
        message: 'Start report is still a hotspot',
        file: 'src/core/start.ts',
        tool: 'projscan_review',
      },
    ],
    tasks: [
      {
        id: 'task-1',
        priority: 'p1',
        title: 'Extract next start helper',
        why: 'Reduce Mission Control complexity',
        evidence: [],
        files: ['src/core/start.ts'],
        suggestedTools: ['projscan_file'],
        verification: {
          commands: ['npm run test -- tests/core/start.test.ts'],
          expected: 'start tests pass',
        },
        handoffText: 'Keep the extraction small.',
      },
    ],
    coordination: {
      touchedFiles: [],
      conflicts: [],
      recommendedNextAgent: 'agent-alpha',
    },
    suggestedNextActions: [
      {
        label: 'Run workplan action',
        command: 'projscan workplan --mode before_edit --format json',
        tool: 'projscan_workplan',
      },
    ],
    ...overrides,
  };
}

describe('Mission Control policy helpers', () => {
  test('classifies mission status and headline text', () => {
    const warningGap: StartAdoptionGap = {
      id: 'docs',
      status: 'warn',
      title: 'Docs missing',
      summary: 'Guide needs an example.',
    };

    expect(missionStatus('pass', 'proceed', [])).toBe('ready');
    expect(missionStatus('fail', 'proceed', [])).toBe('blocked');
    expect(missionStatus('pass', 'block', [])).toBe('blocked');
    expect(missionStatus('pass', 'proceed', [{ ...warningGap, status: 'fail' }])).toBe(
      'needs_setup',
    );
    expect(missionStatus('warn', 'proceed', [])).toBe('needs_attention');
    expect(missionStatus('pass', 'caution', [warningGap])).toBe('needs_attention');

    expect(headlineForStatus('blocked', 'Run proof')).toBe('Blocked: Run proof');
    expect(headlineForStatus('needs_setup', 'Run proof')).toBe('Set up first: Run proof');
    expect(headlineForStatus('needs_attention', 'Run proof')).toBe('Proceed carefully: Run proof');
    expect(headlineForStatus('ready', 'Run proof')).toBe('Next move: Run proof');
  });

  test('keeps route why-now and action-plan fallback behavior stable', () => {
    expect(
      routedWhyNow(route('projscan_impact', { intent: 'what breaks if I rename auth' }), [
        searchAction,
      ]),
    ).toBe(
      'Intent matched "what breaks if I rename auth", but the target is a phrase, so search first and then run projscan_impact on the exact symbol or file.',
    );
    expect(
      routedWhyNow(route('projscan_fix_suggest', { intent: 'fix issue' }), [
        { label: 'Run doctor', tool: 'projscan_doctor' },
      ]),
    ).toBe(
      'Intent matched "fix issue", but no issue id was named, so run projscan_doctor first and then run projscan_fix_suggest on the selected issue.',
    );
    expect(
      routedWhyNow(route('projscan_upgrade', { intent: 'upgrade dependency' }), [
        { label: 'List outdated', tool: 'projscan_outdated' },
      ]),
    ).toBe(
      'Intent matched "upgrade dependency", but no package was named, so run projscan_outdated first and then run projscan_upgrade on the selected package.',
    );
    expect(
      routedWhyNow(route('projscan_review', { intent: 'review my change' }), [
        { label: 'Review', tool: 'projscan_review' },
      ]),
    ).toBe(
      'Intent matched "review my change", so start with projscan_review before broader workflow commands.',
    );

    const workflow: StartWorkflowRecommendation = {
      id: 'before_edit',
      name: 'Before Edit',
      why: 'Use before editing.',
      commands: ['projscan workplan --mode before_edit --format json'],
      mcpTools: ['projscan_workplan'],
    };
    expect(
      missionActionPlan(
        'before_edit',
        undefined,
        undefined,
        {
          id: 'fix-first',
          title: 'Fix first recommendation',
          source: 'review',
          priority: 'p1',
          whyFirst: 'Highest impact',
          files: ['src/core/start.ts'],
          commands: ['projscan review --format json'],
        },
        workplan(),
        workflow,
      ),
    ).toEqual([{ label: 'Fix first recommendation', command: 'projscan review --format json' }]);
    expect(
      missionActionPlan('before_edit', undefined, undefined, undefined, workplan(), workflow),
    ).toEqual([
      {
        label: 'Extract next start helper',
        command: 'npm run test -- tests/core/start.test.ts',
        tool: 'projscan_file',
      },
    ]);
  });

  test('builds unresolved inputs, ready actions, guardrails, and proof commands without placeholder proof', () => {
    const actionPlan = [searchAction, symbolImpactAction, fileImpactAction, symbolImpactAction];
    const unresolved = missionUnresolvedInputs(actionPlan);

    expect(unresolved).toEqual([
      {
        name: 'symbol',
        placeholder: '<symbol-from-search>',
        sourceAction: 'Find exact target for impact analysis',
        instruction:
          'Replace <symbol-from-search> with an exported symbol returned by the search step.',
      },
      {
        name: 'file',
        placeholder: '<file-from-search>',
        sourceAction: 'Find exact target for impact analysis',
        instruction: 'Replace <file-from-search> with a file path returned by the search step.',
      },
    ]);
    expect(missionReadyActions(actionPlan)).toEqual([searchAction]);

    const guardrails = missionGuardrails(
      'before_edit',
      [
        {
          id: 'session',
          label: 'Review touched files',
          command: 'projscan session touched --format json',
          priority: 'high',
          message: 'Touched files exist.',
        },
      ],
      searchAction,
    );
    expect(guardrails.map((action) => action.command)).toEqual([
      'projscan preflight --mode before_edit --format json',
      'projscan understand --view verify --format json',
      'projscan session touched --format json',
    ]);

    expect(missionProofCommands('before_edit', workplan(), guardrails, actionPlan)).toEqual([
      'projscan search "auth token loader" --format json',
      'projscan preflight --mode before_edit --format json',
      'projscan understand --view verify --format json',
      'projscan session touched --format json',
      'npm run test -- tests/core/start.test.ts',
    ]);
  });

  test('chooses workflows, combines risks, and summarizes the start recommendation', () => {
    const recipes: AgentWorkflowRecipe[] = [
      {
        id: 'before_edit',
        name: 'Before Edit',
        useWhen: 'Use before editing.',
        outcome: 'Plan a safe change.',
        commands: ['projscan workplan --mode before_edit --format json'],
        mcpTools: ['projscan_workplan'],
        handoff: 'handoff',
      },
      {
        id: 'pre_merge',
        name: 'Pre Merge',
        useWhen: 'Use before merge.',
        outcome: 'Gate merge risk.',
        commands: ['projscan preflight --mode before_merge --format json'],
        mcpTools: ['projscan_preflight'],
        handoff: 'handoff',
      },
      {
        id: 'bug_hunt',
        name: 'Bug Hunt',
        useWhen: 'Use for hardening.',
        outcome: 'Find likely defects.',
        commands: ['projscan bug-hunt --format json'],
        mcpTools: ['projscan_bug_hunt'],
        handoff: 'handoff',
      },
    ];
    expect(chooseWorkflow('before_merge', recipes)).toEqual({
      id: 'pre_merge',
      name: 'Pre Merge',
      why: 'Use before merge. Gate merge risk.',
      commands: ['projscan preflight --mode before_merge --format json'],
      mcpTools: ['projscan_preflight'],
    });
    expect(chooseWorkflow('hardening', recipes).id).toBe('bug_hunt');

    const qualityRisk: QualityScorecardRisk = {
      id: 'maintainability-start',
      priority: 'p2',
      title: 'Start remains large',
      source: 'hotspot',
      files: ['src/core/start.ts'],
      command: 'projscan file src/core/start.ts --format json',
    };
    expect(combineRisks(workplan(), [qualityRisk], 3)).toEqual([
      {
        id: 'start-workplan-1',
        priority: 'p1',
        title: 'Start report is still a hotspot',
        source: 'verification',
        files: ['src/core/start.ts'],
        command: 'projscan review --format json',
      },
      {
        id: 'start-quality-maintainability-start',
        priority: 'p2',
        title: 'Start remains large',
        source: 'hotspot',
        files: ['src/core/start.ts'],
        command: 'projscan file src/core/start.ts --format json',
      },
    ]);
    expect(combineRisks(workplan({ topRisks: [] }), [], 3)[0]).toEqual({
      id: 'start-baseline',
      priority: 'p2',
      title: 'Preserve the clean baseline',
      source: 'baseline',
      files: [],
      command: 'projscan start --format json',
    });
    expect(
      summarize('before_edit', workplan(), 2, 1, 'Fix first recommendation', 'healthy'),
    ).toBe(
      'start: before_edit recommends Fix first recommendation with 2 quality watch item(s) and 1 adoption gap(s)',
    );
    expect(
      summarize('before_edit', workplan(), 2, 1, 'Fix first recommendation', 'excellent'),
    ).toBe(
      'start: before_edit recommends Fix first recommendation with 2 quality watch item(s) and 1 adoption gap(s)',
    );
    expect(
      summarize('before_edit', workplan(), 2, 1, 'Fix first recommendation', 'needs_attention'),
    ).toBe(
      'start: before_edit recommends Fix first recommendation with 2 quality risk(s) and 1 adoption gap(s)',
    );
    expect(
      summarize('before_edit', workplan(), 2, 1, 'Fix first recommendation', 'blocked'),
    ).toBe(
      'start: before_edit recommends Fix first recommendation with 2 quality risk(s) and 1 adoption gap(s)',
    );
  });
});
