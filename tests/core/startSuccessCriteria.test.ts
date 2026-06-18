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

  it('keeps file history, read, and test-authoring criteria ordered', () => {
    const criteria = successCriteria({
      route: route('projscan_file', ['last', 'read', 'write', 'test']),
      actionPlan: [
        action('Inspect file', 'projscan file src/core/start.ts --format json', 'projscan_file'),
      ],
    });

    expect(criteria).toEqual([
      'Primary author, recent history, and ownership signals are reviewed before routing reviewers or changing the file.',
      'Coverage, hotspot risk, and related test evidence for the file are reviewed before editing starts.',
      'File purpose, risky functions, coverage, and existing test evidence are reviewed before designing a new test.',
      'Purpose, imports, exports, ownership, tests, and risk are reviewed before changing the named file.',
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

  it('keeps understand view criteria by selected view', () => {
    const cases = [
      {
        view: 'flow',
        expected: [
          'Runtime entrypoints, flow paths, and side-effect evidence are reviewed before changing request or execution paths.',
          'The developer knows which files sit on the relevant runtime path.',
        ],
      },
      {
        view: 'verify',
        expected: [
          'Verification tiers, direct-test gaps, and likely proof commands are reviewed before pushing or asking for review.',
          'The developer has the smallest rerunnable command plus the fallback full gate for the intended change.',
        ],
      },
      {
        view: 'change',
        expected: [
          'Change-readiness risks, blast radius, and verification tiers are reviewed before editing starts.',
          'The developer knows which follow-up impact, test, or preflight command gates the change.',
        ],
      },
      {
        view: 'map',
        expected: [
          'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
          'The developer has a cited repo map and knows which files to inspect next.',
        ],
      },
    ];

    for (const testCase of cases) {
      const criteria = successCriteria({
        route: route('projscan_understand', ['understand', testCase.view]),
        actionPlan: [
          action(
            `Understand ${testCase.view}`,
            `projscan understand --view ${testCase.view} --format json`,
            'projscan_understand',
            {
              view: testCase.view,
            },
          ),
        ],
      });

      expect(criteria).toEqual([
        ...testCase.expected,
        'The next task has a verification command: npm test -- tests/core/start.test.ts',
      ]);
    }
  });

  it('keeps understand contract criteria by matched setup signal', () => {
    const cases = [
      {
        keywords: ['npm', 'script'],
        expected: [
          'Package scripts, test commands, and config contracts are reviewed before running local commands.',
          'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
        ],
      },
      {
        keywords: ['database', 'seed'],
        expected: [
          'Package scripts and config contracts identify the seed, reset, or migration command before shell commands are guessed.',
          'The developer knows database setup preconditions, required env vars, and the safest local command to run.',
        ],
      },
      {
        keywords: ['env', 'required'],
        expected: [
          'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
          'The developer knows which env names, defaults, or config files need local values before running the app.',
        ],
      },
      {
        keywords: ['public', 'api'],
        expected: [
          'Public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces.',
          'The developer knows which exported files or symbols need compatibility checks.',
        ],
      },
    ];

    for (const testCase of cases) {
      const criteria = successCriteria({
        route: route('projscan_understand', testCase.keywords),
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
        ...testCase.expected,
        'The next task has a verification command: npm test -- tests/core/start.test.ts',
      ]);
    }
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

  it('keeps regression-plan criteria by level and matched signal', () => {
    const cases = [
      {
        keywords: ['regression', 'smoke'],
        level: 'smoke',
        expected:
          'The smoke regression plan identifies the smallest health and preflight commands to rerun.',
      },
      {
        keywords: ['production', 'incident'],
        expected:
          'The focused regression plan identifies the smallest high-signal commands to reproduce and verify the failure.',
      },
      {
        keywords: ['connection', 'eaddrinuse'],
        expected:
          'The focused regression plan identifies the local setup command, environment symptom, and smallest rerun proof for the blocker.',
      },
      {
        keywords: ['regression', 'invalid'],
        level: 'wide',
        expected:
          'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      },
    ];

    for (const testCase of cases) {
      const criteria = successCriteria({
        route: route('projscan_regression_plan', testCase.keywords),
        actionPlan: [
          action(
            'Plan regression',
            'projscan regression-plan --level focused --format json',
            'projscan_regression_plan',
            testCase.level ? { level: testCase.level } : undefined,
          ),
        ],
      });

      expect(criteria).toEqual([
        testCase.expected,
        'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
        'The next task has a verification command: npm test -- tests/core/start.test.ts',
      ]);
    }
  });

  it('keeps dependency criteria by matched signal', () => {
    const cases = [
      {
        keywords: ['license'],
        expected: [
          'Dependency license counts, unknown licenses, and copyleft risks are reviewed before third-party notices or compliance sign-off.',
          'Declared production and development dependencies are inventoried before package changes are planned.',
          'Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.',
          'The next task has a verification command: npm test -- tests/core/start.test.ts',
        ],
      },
      {
        keywords: ['bundle'],
        expected: [
          'Installed package-size totals and largest packages are reviewed before bundle-size or dependency-bloat work starts.',
          'Declared production and development dependencies are inventoried before package changes are planned.',
          'Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.',
          'The next task has a verification command: npm test -- tests/core/start.test.ts',
        ],
      },
      {
        keywords: ['license', 'bundle'],
        expected: [
          'Dependency license counts, unknown licenses, and copyleft risks are reviewed before third-party notices or compliance sign-off.',
          'Installed package-size totals and largest packages are reviewed before bundle-size or dependency-bloat work starts.',
          'Declared production and development dependencies are inventoried before package changes are planned.',
          'Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.',
        ],
      },
      {
        keywords: ['dependencies'],
        expected: [
          'Declared production and development dependencies are inventoried before package changes are planned.',
          'Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.',
          'The next task has a verification command: npm test -- tests/core/start.test.ts',
        ],
      },
    ];

    for (const testCase of cases) {
      const criteria = successCriteria({
        route: route('projscan_dependencies', testCase.keywords),
        actionPlan: [
          action(
            'Inspect dependencies',
            'projscan dependencies --format json',
            'projscan_dependencies',
          ),
        ],
      });

      expect(criteria).toEqual(testCase.expected);
    }
  });

  it('keeps coupling criteria by selected direction', () => {
    const cases = [
      {
        args: { direction: 'cycles_only' },
        expected: [
          'Circular-import cycles are reviewed with the exact files participating in each strongly connected component.',
          'Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.',
          'The next task has a verification command: npm test -- tests/core/start.test.ts',
        ],
      },
      {
        args: undefined,
        expected: [
          'Fan-in, fan-out, instability, cross-package edges, and circular-import cycles are reviewed before refactoring boundaries.',
          'Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.',
          'The next task has a verification command: npm test -- tests/core/start.test.ts',
        ],
      },
    ];

    for (const testCase of cases) {
      const criteria = successCriteria({
        route: route('projscan_coupling', ['coupling']),
        actionPlan: [
          action(
            'Inspect coupling',
            'projscan coupling --format json',
            'projscan_coupling',
            testCase.args,
          ),
        ],
      });

      expect(criteria).toEqual(testCase.expected);
    }
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
