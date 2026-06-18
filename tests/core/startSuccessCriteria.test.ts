import { describe, expect, it } from 'vitest';

import {
  buildMissionSuccessCriteria,
  type MissionSuccessCriteriaInput,
} from '../../src/core/startSuccessCriteria.js';
import type {
  PreflightSuggestedAction,
  StartRoutedIntent,
  WorkplanMode,
  WorkplanReport,
} from '../../src/types.js';

describe('Mission Control success criteria', () => {
  it('preserves preflight criteria with the routed mode', () => {
    const criteria = successCriteria({
      mode: 'before_edit',
      route: route('projscan_preflight', ['commit']),
      actionPlan: [
        action(
          'Run preflight',
          'projscan preflight --mode before_commit --format json',
          'projscan_preflight',
          {
            mode: 'before_commit',
          },
        ),
      ],
    });

    expect(criteria).toEqual([
      'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
      'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
      'The next task has a verification command: npm test -- tests/core/start.test.ts',
    ]);
  });

  it('keeps fuzzy impact criteria gated by search target selection', () => {
    const criteria = successCriteria({
      route: route('projscan_impact', ['rename']),
      actionPlan: [
        action(
          'Find exact target for impact analysis',
          'projscan search "auth token loader" --format json',
          'projscan_search',
          {
            query: 'auth token loader',
          },
        ),
      ],
    });

    expect(criteria).toEqual([
      'An exact symbol or file path is selected from search results before impact analysis continues.',
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
      'Affected call sites, tests, or owners are added to the workplan before code changes begin.',
      'The next task has a verification command: npm test -- tests/core/start.test.ts',
    ]);
  });

  it('keeps product-planning workplan criteria for explicit product routes', () => {
    const criteria = successCriteria({
      mode: 'bug_hunt',
      route: route('projscan_workplan', ['build', 'next', 'product'], 'high'),
      actionPlan: [
        action(
          'Use workplan',
          'projscan workplan --mode bug_hunt --format json',
          'projscan_workplan',
          {
            mode: 'bug_hunt',
          },
        ),
      ],
    });

    expect(criteria).toEqual([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
      'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
      'The next task has a verification command: npm test -- tests/core/start.test.ts',
    ]);
  });

  it('keeps generic build-next workplan criteria in before-edit mode', () => {
    const criteria = successCriteria({
      mode: 'before_edit',
      route: route('projscan_workplan', ['build', 'next'], 'high'),
      actionPlan: [
        action(
          'Use workplan',
          'projscan workplan --mode before_edit --format json',
          'projscan_workplan',
          {
            mode: 'before_edit',
          },
        ),
      ],
    });

    expect(criteria).toEqual([
      'The workplan identifies the first safe implementation or review step before edits begin.',
      'The selected action has a focused verification command before handoff.',
      'The next task has a verification command: npm test -- tests/core/start.test.ts',
    ]);
  });

  it('keeps file criteria ordered by matched evidence', () => {
    const criteria = successCriteria({
      route: route('projscan_file', ['risk', 'coverage', 'reviewer']),
      actionPlan: [
        action('Inspect file', 'projscan file src/core/start.ts --format json', 'projscan_file'),
      ],
    });

    expect(criteria).toEqual([
      'Hotspot reasons, related issues, imports, exports, and ownership explain why the file is risky.',
      'Coverage, hotspot risk, and related test evidence for the file are reviewed before editing starts.',
      'Ownership, primary author, hotspot risk, and related issues are reviewed before choosing a reviewer.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
    ]);
  });

  it('keeps local-service understand contract criteria', () => {
    const criteria = successCriteria({
      route: route('projscan_understand', ['run', 'local', 'services']),
      actionPlan: [
        action(
          'Understand contracts',
          'projscan understand --view contracts --format json',
          'projscan_understand',
          {
            view: 'contracts',
          },
        ),
      ],
    });

    expect(criteria).toEqual([
      'Local service startup scripts, container commands, and required config are reviewed before running dev services.',
      'The developer knows the safest command to start local services plus any env, port, or dependency preconditions.',
      'The next task has a verification command: npm test -- tests/core/start.test.ts',
    ]);
  });

  it('keeps regression-plan level criteria', () => {
    const criteria = successCriteria({
      route: route('projscan_regression_plan', ['regression', 'full']),
      actionPlan: [
        action(
          'Plan regression',
          'projscan regression-plan --level full --format json',
          'projscan_regression_plan',
          {
            level: 'full',
          },
        ),
      ],
    });

    expect(criteria).toEqual([
      'The full regression plan identifies release-grade build, lint, stability, and test commands to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
      'The next task has a verification command: npm test -- tests/core/start.test.ts',
    ]);
  });
});

function successCriteria(input: Partial<MissionSuccessCriteriaInput>): string[] {
  return buildMissionSuccessCriteria({
    mode: 'before_edit',
    route: undefined,
    actionPlan: [],
    workplan: workplan(),
    ...input,
  });
}

function action(
  label: string,
  command: string,
  tool: string,
  args?: Record<string, unknown>,
): PreflightSuggestedAction {
  return {
    label,
    command,
    tool,
    ...(args ? { args } : {}),
  };
}

function route(
  tool: string,
  matchedKeywords: string[],
  confidence: StartRoutedIntent['confidence'] = 'high',
): StartRoutedIntent {
  return {
    intent: `Route ${tool}`,
    category: 'Test',
    tool,
    cli: tool.replace('projscan_', 'projscan '),
    why: 'test route',
    example: `${tool} --format json`,
    confidence,
    rank: 1,
    score: matchedKeywords.length,
    matchedKeywords,
  };
}

function workplan(mode: WorkplanMode = 'before_edit'): WorkplanReport {
  return {
    schemaVersion: 1,
    mode,
    verdict: 'proceed',
    summary: 'test workplan',
    topRisks: [],
    tasks: [
      {
        id: 'task-1',
        priority: 'p1',
        title: 'Verify start behavior',
        why: 'pins success criteria',
        evidence: [],
        files: ['src/core/start.ts'],
        suggestedTools: ['projscan_start'],
        verification: {
          commands: ['npm test -- tests/core/start.test.ts'],
          expected: 'tests pass',
        },
        handoffText: 'run the focused test',
      },
    ],
    coordination: {
      touchedFiles: [],
      conflicts: [],
      recommendedNextAgent: 'maintainer',
    },
    suggestedNextActions: [],
  };
}
