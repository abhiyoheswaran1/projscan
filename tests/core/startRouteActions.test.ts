import { describe, expect, test } from 'vitest';
import {
  actionFromRoute,
  actionPlanFromRoute,
  argsFromRouteIntent,
  commandFromRouteIntent,
} from '../../src/core/startRouteActions.js';
import type { StartRoutedIntent, WorkplanMode } from '../../src/types.js';

function route(tool: string, overrides: Partial<StartRoutedIntent> = {}): StartRoutedIntent {
  return {
    intent: `Test route for ${tool}`,
    category: 'Test',
    tool,
    cli: tool.replace(/^projscan_/, 'projscan '),
    why: 'Exercise route action rendering.',
    example: `${tool} example`,
    confidence: 'high',
    rank: 1,
    score: 10,
    matchedKeywords: [],
    ...overrides,
  };
}

describe('Mission Control route action rendering', () => {
  test('renders direct route commands and args for simple route tools', () => {
    const cases: Array<{
      tool: string;
      intent: string;
      mode?: WorkplanMode;
      args: Record<string, unknown>;
      command: string;
    }> = [
      {
        tool: 'projscan_privacy_check',
        intent: 'can this tool contact the network',
        args: { offline: true },
        command: 'projscan privacy-check --offline',
      },
      {
        tool: 'projscan_preflight',
        intent: 'is it safe to commit this change',
        args: { mode: 'before_commit' },
        command: 'projscan preflight --mode before_commit --format json',
      },
      {
        tool: 'projscan_search',
        intent: 'what rate limits protect checkout?',
        args: { query: 'checkout rate limits' },
        command: 'projscan search "checkout rate limits" --format json',
      },
      {
        tool: 'projscan_audit',
        intent: 'does chalk have vulnerabilities?',
        args: { package: 'chalk' },
        command: 'projscan audit --package chalk --format json',
      },
      {
        tool: 'projscan_file',
        intent: 'show me src/core/start.ts',
        args: { file: 'src/core/start.ts' },
        command: 'projscan file src/core/start.ts --format json',
      },
      {
        tool: 'projscan_understand',
        intent: 'what tests should I run before pushing',
        args: { view: 'verify', intent: 'what tests should I run before pushing' },
        command:
          'projscan understand --view verify --intent "what tests should I run before pushing" --format json',
      },
      {
        tool: 'projscan_workplan',
        intent: 'what should I do next',
        mode: 'before_merge',
        args: { mode: 'before_merge' },
        command: 'projscan workplan --mode before_merge --format json',
      },
      {
        tool: 'projscan_agent_brief',
        intent: 'handoff to release agent',
        args: { intent: 'release' },
        command: 'projscan agent-brief --intent release --format json',
      },
      {
        tool: 'projscan_session',
        intent: 'show current session status',
        args: { action: 'current' },
        command: 'projscan session --format json',
      },
      {
        tool: 'projscan_regression_plan',
        intent: 'what full regression should I run before merge',
        args: { level: 'full' },
        command: 'projscan regression-plan --level full --format json',
      },
      {
        tool: 'projscan_evidence_pack',
        intent: 'write a PR comment for reviewers',
        args: { pr_comment: true },
        command: 'projscan evidence-pack --pr-comment',
      },
    ];

    for (const entry of cases) {
      const routed = route(entry.tool);
      const mode = entry.mode ?? 'before_edit';
      const args = argsFromRouteIntent(mode, entry.intent, routed);

      expect(args).toEqual(entry.args);
      expect(commandFromRouteIntent(entry.intent, routed, args)).toBe(entry.command);
      expect(actionFromRoute(mode, entry.intent, routed)).toEqual({
        label: `Use ${entry.tool} for ${entry.intent}`,
        command: entry.command,
        tool: entry.tool,
        args: entry.args,
      });
    }
  });

  test('renders direct issue, package, graph, coupling, and claim route actions', () => {
    expect(
      actionPlanFromRoute('before_edit', 'fix no-console-log', route('projscan_fix_suggest')),
    ).toEqual([
      {
        label: 'Use projscan_fix_suggest for no-console-log',
        command: 'projscan fix-suggest no-console-log --format json',
        tool: 'projscan_fix_suggest',
        args: { issue_id: 'no-console-log' },
      },
    ]);
    expect(
      actionPlanFromRoute(
        'before_edit',
        'explain issue no-console-log',
        route('projscan_explain_issue'),
      ),
    ).toEqual([
      {
        label: 'Explain issue no-console-log',
        command: 'projscan explain-issue no-console-log --format json',
        tool: 'projscan_explain_issue',
        args: { issue_id: 'no-console-log' },
      },
    ]);
    expect(actionPlanFromRoute('before_edit', 'upgrade chalk', route('projscan_upgrade'))).toEqual([
      {
        label: 'Preview upgrade impact for chalk',
        command: 'projscan upgrade chalk --format json',
        tool: 'projscan_upgrade',
        args: { package: 'chalk' },
      },
    ]);
    expect(
      actionPlanFromRoute(
        'before_edit',
        'who imports src/core/start.ts',
        route('projscan_semantic_graph'),
      ),
    ).toEqual([
      {
        label: 'Run targeted graph query for who imports src/core/start.ts',
        command: 'projscan semantic-graph --query importers --file src/core/start.ts --format json',
        tool: 'projscan_semantic_graph',
        args: { query: { direction: 'importers', file: 'src/core/start.ts' } },
      },
    ]);
    expect(
      actionPlanFromRoute(
        'before_edit',
        'show circular dependency cycles',
        route('projscan_coupling'),
      ),
    ).toEqual([
      {
        label: 'Inspect circular import cycles',
        command: 'projscan coupling --cycles-only --format json',
        tool: 'projscan_coupling',
        args: { direction: 'cycles_only' },
      },
    ]);
    expect(
      actionPlanFromRoute(
        'before_edit',
        'claim src/core/start.ts for alice',
        route('projscan_claim'),
      ),
    ).toEqual([
      {
        label: 'Add claim for src/core/start.ts',
        command: 'projscan claim add src/core/start.ts --agent alice',
        tool: 'projscan_claim',
        args: { action: 'add', target: 'src/core/start.ts', agent: 'alice' },
      },
    ]);
  });

  test('renders discovery follow-ups when a routed intent is missing required input', () => {
    expect(
      actionPlanFromRoute(
        'before_edit',
        'what breaks if I rename the auth token loader',
        route('projscan_impact'),
      ),
    ).toEqual([
      {
        label: 'Find exact target for impact analysis',
        command: 'projscan search "auth token loader" --format json',
        tool: 'projscan_search',
        args: { query: 'auth token loader' },
      },
      {
        label: 'If search returns an exported symbol',
        command: 'projscan impact --symbol <symbol-from-search> --format json',
        tool: 'projscan_impact',
        args: { symbol: '<symbol-from-search>' },
      },
      {
        label: 'If search returns a file path',
        command: 'projscan impact <file-from-search> --format json',
        tool: 'projscan_impact',
        args: { file: '<file-from-search>' },
      },
    ]);
    expect(
      actionPlanFromRoute('before_edit', 'fix the issue', route('projscan_fix_suggest')),
    ).toEqual([
      {
        label: 'Find open issues before choosing a fix suggestion',
        command: 'projscan doctor --format json',
        tool: 'projscan_doctor',
      },
      {
        label: 'Use fix-suggest for the selected issue',
        command: 'projscan fix-suggest <issue-id-from-doctor> --format json',
        tool: 'projscan_fix_suggest',
        args: { issue_id: '<issue-id-from-doctor>' },
      },
    ]);
    expect(
      actionPlanFromRoute('before_edit', 'preview dependency upgrade', route('projscan_upgrade')),
    ).toEqual([
      {
        label: 'Find package candidates before previewing an upgrade',
        command: 'projscan outdated --format json',
        tool: 'projscan_outdated',
      },
      {
        label: 'Preview upgrade impact for the selected package',
        command: 'projscan upgrade <package-from-outdated> --format json',
        tool: 'projscan_upgrade',
        args: { package: '<package-from-outdated>' },
      },
    ]);
  });

  test('keeps shell-sensitive freeform route commands escaped', () => {
    expect(
      actionPlanFromRoute(
        'before_edit',
        'what breaks if I rename $(touch /tmp/projscan-quote-pwn) auth `token` loader',
        route('projscan_impact'),
      )[0],
    ).toEqual({
      label: 'Find exact target for impact analysis',
      command:
        'projscan search "\\$(touch /tmp/projscan-quote-pwn) auth \\`token\\` loader" --format json',
      tool: 'projscan_search',
      args: { query: '$(touch /tmp/projscan-quote-pwn) auth `token` loader' },
    });
  });
});
