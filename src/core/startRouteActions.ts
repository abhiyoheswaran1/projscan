import {
  escapeDoubleQuoted,
  extractAuditPackageTarget,
  extractClaimAgent,
  extractClaimTarget,
  extractFileTarget,
  extractImpactTarget,
  extractIssueIdTarget,
  extractPackageTarget,
  extractReportScopeTarget,
  extractSearchQuery,
  graphQueryFromIntent,
  graphQueryIsReady,
  isExactSymbolTarget,
  isFilePathTarget,
  isPlaceholder,
  quoteShellArg,
  quoteShellArgOrPlaceholder,
  semanticGraphCommand,
  type StartGraphQuery,
} from './startIntentTargets.js';
import { preflightModeFromIntent } from './startMode.js';
import type { AgentBriefIntent } from '../types/agentBrief.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { RegressionPlanLevel } from '../types/regressionPlan.js';
import type { StartRoutedIntent } from '../types/start.js';
import type { UnderstandView } from '../types/understand.js';
import type { WorkplanMode } from '../types/workplan.js';

interface RouteArgContext {
  mode: WorkplanMode;
  intent: string;
}
interface RouteCommandContext {
  args: Record<string, unknown>;
}

type RouteArgBuilder = (context: RouteArgContext) => Record<string, unknown>;
type RouteCommandBuilder = (context: RouteCommandContext) => string;
type UnderstandViewRule = { view: UnderstandView; matches: (text: string) => boolean };

const ROUTE_ARG_BUILDERS: Record<string, RouteArgBuilder> = {
  projscan_privacy_check: () => ({ offline: true }),
  projscan_preflight: ({ intent }) => ({ mode: preflightModeFromIntent(intent) }),
  projscan_search: ({ intent }) => ({ query: extractSearchQuery(intent) }),
  projscan_fix_suggest: ({ intent }) => ({
    issue_id: extractIssueIdTarget(intent) ?? '<issue-id-from-doctor>',
  }),
  projscan_explain_issue: ({ intent }) => ({
    issue_id: extractIssueIdTarget(intent) ?? '<issue-id-from-doctor>',
  }),
  projscan_upgrade: ({ intent }) => ({
    package: extractPackageTarget(intent) ?? '<package-from-outdated>',
  }),
  projscan_audit: ({ intent }) => auditArgsFromIntent(intent),
  projscan_semantic_graph: ({ intent }) => ({
    query: graphQueryFromIntent(intent) ?? { direction: 'importers', file: '<file-from-intent>' },
  }),
  projscan_coupling: ({ intent }) => couplingArgsFromIntent(intent),
  projscan_file: ({ intent }) => ({ file: extractFileTarget(intent) ?? '<file-from-intent>' }),
  projscan_understand: ({ intent }) => understandArgsFromIntent(intent),
  projscan_workplan: ({ mode }) => ({ mode }),
  projscan_agent_brief: ({ intent }) => ({ intent: agentBriefIntentFromIntent(intent) }),
  projscan_session: ({ intent }) => ({ action: sessionActionFromIntent(intent) }),
  projscan_claim: ({ intent }) => claimArgsFromIntent(intent),
  projscan_regression_plan: ({ intent }) => ({ level: regressionLevelFromIntent(intent) }),
  projscan_evidence_pack: () => ({ pr_comment: true }),
  projscan_analyze: ({ intent }) => reportControlArgsFromIntent(intent),
};

const ROUTE_COMMAND_BUILDERS: Record<string, RouteCommandBuilder> = {
  projscan_privacy_check: () => 'projscan privacy-check --offline',
  projscan_preflight: ({ args }) => `projscan preflight --mode ${String(args.mode)} --format json`,
  projscan_search: ({ args }) =>
    `projscan search "${escapeDoubleQuoted(String(args.query))}" --format json`,
  projscan_fix_suggest: ({ args }) => issueCommand('fix-suggest', args.issue_id),
  projscan_explain_issue: ({ args }) => issueCommand('explain-issue', args.issue_id),
  projscan_upgrade: ({ args }) => upgradeCommandFromArgs(args),
  projscan_audit: ({ args }) => auditCommandFromArgs(args),
  projscan_semantic_graph: ({ args }) => semanticGraphCommand(args.query as StartGraphQuery),
  projscan_coupling: ({ args }) => couplingCommandFromArgs(args),
  projscan_file: ({ args }) => `projscan file ${quoteShellArg(String(args.file))} --format json`,
  projscan_understand: ({ args }) => understandCommandFromArgs(args),
  projscan_workplan: ({ args }) => `projscan workplan --mode ${String(args.mode)} --format json`,
  projscan_agent_brief: ({ args }) =>
    `projscan agent-brief --intent ${String(args.intent)} --format json`,
  projscan_session: ({ args }) => sessionCommandFromAction(String(args.action)),
  projscan_claim: ({ args }) => claimCommandFromArgs(args),
  projscan_regression_plan: ({ args }) =>
    `projscan regression-plan --level ${String(args.level)} --format json`,
  projscan_evidence_pack: () => 'projscan evidence-pack --pr-comment',
  projscan_analyze: ({ args }) => reportControlCommand('analyze', 'json', args),
};

const UNDERSTAND_VIEW_RULES: readonly UnderstandViewRule[] = [
  { view: 'contracts', matches: isPackageScriptDiscoveryIntent },
  {
    view: 'contracts',
    matches: (text) =>
      /\bnpm\s+scripts?\b|\bscripts?\s+(?:exist|available|defined|configured)\b/.test(text),
  },
  { view: 'contracts', matches: isLocalServiceSetupIntent },
  {
    view: 'contracts',
    matches: (text) =>
      /\b(?:seed|seeds|reset|resets|migrate|migrates|run|runs)\b.*\b(?:database|db|migrations?)\b|\b(?:database|db|migrations?)\b.*\b(?:seed|seeds|reset|resets|migrate|migrates|run|runs|command)\b/.test(
        text,
      ),
  },
  {
    view: 'contracts',
    matches: (text) =>
      /\b(?:contract|contracts|public\s+api|public\s+apis|public\s+exports?|api\s+surface|deprecat(?:e|es|ed|ion|ing)|compatibility|compatible|env(?:ironment)?\s+vars?|env(?:ironment)?\s+variables?|config|configuration)\b/.test(
        text,
      ),
  },
  {
    view: 'flow',
    matches: (text) => /\b(?:flow|flows|runtime|request\s+path|execution\s+path)\b/.test(text),
  },
  { view: 'verify', matches: isVerificationPlanningIntent },
  {
    view: 'verify',
    matches: (text) => /\b(?:verify|verification|proof|test\s+plan|checks?)\b/.test(text),
  },
  {
    view: 'change',
    matches: (text) =>
      /\b(?:change|readiness|before\s+changing|before\s+rename|feature|endpoint|button|where\s+should\s+i\s+(?:put|add)|files\s+do\s+i\s+need\s+to\s+change|add|implement|build|create|wire|route|component|page|screen|view|webhook|login|checkout|migration|migrations|database|db|schema|table|column)\b/.test(
        text,
      ),
  },
];

export function actionFromRoute(
  mode: WorkplanMode,
  intent: string,
  route: StartRoutedIntent,
): PreflightSuggestedAction {
  const args = argsFromRouteIntent(mode, intent, route);
  return {
    label: `Use ${route.tool} for ${intent}`,
    command: commandFromRouteIntent(intent, route, args),
    tool: route.tool,
    args,
  };
}

export function actionPlanFromRoute(
  mode: WorkplanMode,
  intent: string,
  route: StartRoutedIntent,
): PreflightSuggestedAction[] {
  if (route.tool === 'projscan_impact') return impactActionPlan(intent, route);
  if (route.tool === 'projscan_fix_suggest') return fixSuggestActionPlan(intent, route);
  if (route.tool === 'projscan_explain_issue') return explainIssueActionPlan(intent, route);
  if (route.tool === 'projscan_upgrade') return upgradeActionPlan(intent, route);
  if (route.tool === 'projscan_semantic_graph') return semanticGraphActionPlan(intent, route);
  if (route.tool === 'projscan_coupling') return couplingActionPlan(intent, route);
  if (route.tool === 'projscan_claim') return claimActionPlan(intent, route);
  if (route.tool === 'projscan_analyze') return reportControlActionPlan(intent, route);
  return [actionFromRoute(mode, intent, route)];
}

export function argsFromRouteIntent(
  mode: WorkplanMode,
  intent: string,
  route: StartRoutedIntent,
): Record<string, unknown> {
  return ROUTE_ARG_BUILDERS[route.tool]?.({ mode, intent }) ?? {};
}

export function commandFromRouteIntent(
  _intent: string,
  route: StartRoutedIntent,
  args: Record<string, unknown>,
): string {
  return ROUTE_COMMAND_BUILDERS[route.tool]?.({ args }) ?? route.example;
}

function impactActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const target = extractImpactTarget(intent) ?? extractFileTarget(intent);
  const impactLabel = `Use ${route.tool} for ${intent}`;
  if (target && isFilePathTarget(target)) {
    return [
      {
        label: impactLabel,
        command: `projscan impact ${quoteShellArg(target)} --format json`,
        tool: route.tool,
        args: { file: target },
      },
    ];
  }
  if (target && isExactSymbolTarget(target)) {
    return [
      {
        label: impactLabel,
        command: `projscan impact --symbol ${target} --format json`,
        tool: route.tool,
        args: { symbol: target },
      },
    ];
  }
  const searchQuery = target ?? intent;
  return [
    {
      label: 'Find exact target for impact analysis',
      command: `projscan search "${escapeDoubleQuoted(searchQuery)}" --format json`,
      tool: 'projscan_search',
      args: { query: searchQuery },
    },
    {
      label: 'If search returns an exported symbol',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      tool: route.tool,
      args: { symbol: '<symbol-from-search>' },
    },
    {
      label: 'If search returns a file path',
      command: 'projscan impact <file-from-search> --format json',
      tool: route.tool,
      args: { file: '<file-from-search>' },
    },
  ];
}

function fixSuggestActionPlan(
  intent: string,
  route: StartRoutedIntent,
): PreflightSuggestedAction[] {
  const issueId = extractIssueIdTarget(intent);
  if (issueId) {
    return [
      {
        label: `Use ${route.tool} for ${issueId}`,
        command: `projscan fix-suggest ${quoteShellArg(issueId)} --format json`,
        tool: route.tool,
        args: { issue_id: issueId },
      },
    ];
  }

  return [
    {
      label: 'Find open issues before choosing a fix suggestion',
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
    },
    {
      label: 'Use fix-suggest for the selected issue',
      command: 'projscan fix-suggest <issue-id-from-doctor> --format json',
      tool: route.tool,
      args: { issue_id: '<issue-id-from-doctor>' },
    },
  ];
}

function explainIssueActionPlan(
  intent: string,
  route: StartRoutedIntent,
): PreflightSuggestedAction[] {
  const issueId = extractIssueIdTarget(intent);
  if (issueId) {
    return [
      {
        label: `Explain issue ${issueId}`,
        command: `projscan explain-issue ${quoteShellArg(issueId)} --format json`,
        tool: route.tool,
        args: { issue_id: issueId },
      },
    ];
  }

  return [
    {
      label: 'Find open issues before explaining one',
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
    },
    {
      label: 'Explain the selected issue',
      command: 'projscan explain-issue <issue-id-from-doctor> --format json',
      tool: route.tool,
      args: { issue_id: '<issue-id-from-doctor>' },
    },
  ];
}

function upgradeActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const packageName = extractPackageTarget(intent);
  if (packageName) {
    return [
      {
        label: `Preview upgrade impact for ${packageName}`,
        command: `projscan upgrade ${quoteShellArg(packageName)} --format json`,
        tool: route.tool,
        args: { package: packageName },
      },
    ];
  }

  return [
    {
      label: 'Find package candidates before previewing an upgrade',
      command: 'projscan outdated --format json',
      tool: 'projscan_outdated',
    },
    {
      label: 'Preview upgrade impact for the selected package',
      command: 'projscan upgrade <package-from-outdated> --format json',
      tool: route.tool,
      args: { package: '<package-from-outdated>' },
    },
  ];
}

function semanticGraphActionPlan(
  intent: string,
  route: StartRoutedIntent,
): PreflightSuggestedAction[] {
  const query = graphQueryFromIntent(intent);
  if (query && graphQueryIsReady(query)) {
    return [
      {
        label: `Run targeted graph query for ${intent}`,
        command: semanticGraphCommand(query),
        tool: route.tool,
        args: { query },
      },
    ];
  }

  const fallback: StartGraphQuery = {
    direction: query?.direction ?? 'importers',
    file: '<file-from-intent>',
  };
  return [
    {
      label: 'Find the file or symbol for the graph query',
      command: `projscan search "${escapeDoubleQuoted(extractSearchQuery(intent))}" --format json`,
      tool: 'projscan_search',
      args: { query: extractSearchQuery(intent) },
    },
    {
      label: 'Run the targeted graph query',
      command: semanticGraphCommand(fallback),
      tool: route.tool,
      args: { query: fallback },
    },
  ];
}

function couplingActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const direction = couplingDirectionFromIntent(intent);
  if (direction === 'cycles_only') {
    return [
      {
        label: 'Inspect circular import cycles',
        command: 'projscan coupling --cycles-only --format json',
        tool: route.tool,
        args: { direction },
      },
    ];
  }
  if (direction === 'high_fan_in') {
    return [
      {
        label: 'Inspect high fan-in files',
        command: 'projscan coupling --high-fan-in --format json',
        tool: route.tool,
        args: { direction },
      },
    ];
  }
  if (direction === 'high_fan_out') {
    return [
      {
        label: 'Inspect high fan-out files',
        command: 'projscan coupling --high-fan-out --format json',
        tool: route.tool,
        args: { direction },
      },
    ];
  }
  return [
    {
      label: 'Inspect file coupling and instability',
      command: 'projscan coupling --format json',
      tool: route.tool,
      args: {},
    },
  ];
}

function claimActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  if (isClaimListIntent(intent)) return [claimListAction(route)];
  const target = extractClaimTarget(intent) ?? '<target-from-intent>';
  const agent = extractClaimAgent(intent) ?? '<agent-name>';
  const addAction = claimAddAction(route, target, agent);
  if (!isPlaceholder(target) && !isPlaceholder(agent)) return [addAction];
  return [
    {
      label: 'Review active claims before adding a file claim',
      command: 'projscan claim list --format json',
      tool: route.tool,
      args: { action: 'list' },
    },
    addAction,
  ];
}

function claimListAction(route: StartRoutedIntent): PreflightSuggestedAction {
  return {
    label: 'Review active claims',
    command: 'projscan claim list --format json',
    tool: route.tool,
    args: { action: 'list' },
  };
}

function claimAddAction(
  route: StartRoutedIntent,
  target: string,
  agent: string,
): PreflightSuggestedAction {
  return {
    label: `Add claim for ${target}`,
    command: `projscan claim add ${quoteShellArgOrPlaceholder(target)} --agent ${quoteShellArgOrPlaceholder(agent)}`,
    tool: route.tool,
    args: { action: 'add', target, agent },
  };
}

function reportControlActionPlan(
  intent: string,
  route: StartRoutedIntent,
): PreflightSuggestedAction[] {
  const args = reportControlArgsFromIntent(intent);
  const scope = String(args.report_scope);
  return [
    {
      label: `Generate scoped analysis evidence for ${scope}`,
      command: reportControlCommand('analyze', 'json', args),
      tool: route.tool,
      args,
    },
    {
      label: `Generate scoped health evidence for ${scope}`,
      command: reportControlCommand('doctor', 'markdown', args),
      tool: 'projscan_doctor',
      args,
    },
    {
      label: `Generate scoped CI evidence for ${scope}`,
      command: reportControlCommand('ci', 'sarif', args),
      tool: 'projscan_ci',
      args,
    },
  ];
}

function reportControlArgsFromIntent(intent: string): Record<string, unknown> {
  return {
    report_scope: extractReportScopeTarget(intent) ?? '<report-scope>',
    redact_paths: true,
  };
}

function reportControlCommand(
  command: 'analyze' | 'doctor' | 'ci',
  format: 'json' | 'markdown' | 'sarif',
  args: Record<string, unknown>,
): string {
  const scope = String(args.report_scope);
  return `projscan ${command} --report-scope ${quoteShellArgOrPlaceholder(scope)} --redact-paths --format ${format}`;
}

function auditArgsFromIntent(intent: string): Record<string, unknown> {
  const packageName = extractAuditPackageTarget(intent);
  return packageName ? { package: packageName } : {};
}

function couplingArgsFromIntent(intent: string): Record<string, unknown> {
  const direction = couplingDirectionFromIntent(intent);
  return direction ? { direction } : {};
}

function claimArgsFromIntent(intent: string): Record<string, unknown> {
  if (isClaimListIntent(intent)) return { action: 'list' };
  return {
    action: 'add',
    target: extractClaimTarget(intent) ?? '<target-from-intent>',
    agent: extractClaimAgent(intent) ?? '<agent-name>',
  };
}

function understandArgsFromIntent(intent: string): Record<string, unknown> {
  const view = understandViewFromIntent(intent);
  return view === 'change' || view === 'verify' ? { view, intent } : { view };
}

function issueCommand(command: 'fix-suggest' | 'explain-issue', issueIdValue: unknown): string {
  const issueId = String(issueIdValue);
  return `projscan ${command} ${isPlaceholder(issueId) ? issueId : quoteShellArg(issueId)} --format json`;
}

function upgradeCommandFromArgs(args: Record<string, unknown>): string {
  const packageName = String(args.package);
  return `projscan upgrade ${isPlaceholder(packageName) ? packageName : quoteShellArg(packageName)} --format json`;
}

function auditCommandFromArgs(args: Record<string, unknown>): string {
  const packageName = typeof args.package === 'string' ? args.package : undefined;
  return packageName
    ? `projscan audit --package ${quoteShellArg(packageName)} --format json`
    : 'projscan audit --format json';
}

function understandCommandFromArgs(args: Record<string, unknown>): string {
  const view = String(args.view);
  const routedIntent =
    typeof args.intent === 'string' ? ` --intent ${quoteShellArg(args.intent)}` : '';
  return `projscan understand --view ${view}${routedIntent} --format json`;
}

function claimCommandFromArgs(args: Record<string, unknown>): string {
  const action = String(args.action ?? 'list');
  if (action === 'add') {
    const target = String(args.target ?? '<target-from-intent>');
    const agent = String(args.agent ?? '<agent-name>');
    return `projscan claim add ${quoteShellArgOrPlaceholder(target)} --agent ${quoteShellArgOrPlaceholder(agent)}`;
  }
  return 'projscan claim list --format json';
}

function regressionLevelFromIntent(intent: string): RegressionPlanLevel {
  const text = intent.toLowerCase();
  if (/\b(?:smoke|quick|minimum|minimal)\b/.test(text)) return 'smoke';
  if (/\b(?:full|complete|comprehensive|exhaustive|release-grade)\b/.test(text)) return 'full';
  return 'focused';
}

function agentBriefIntentFromIntent(intent: string): AgentBriefIntent {
  const text = intent.toLowerCase();
  if (/\b(?:bug|bugs|fix|hunt)\b/.test(text)) return 'bug_hunt';
  if (/\b(?:release|ship|shipping|publish)\b/.test(text)) return 'release';
  if (/\b(?:refactor|cleanup|simplify)\b/.test(text)) return 'refactor';
  if (/\b(?:hardening|security|dataflow|taint|injection)\b/.test(text)) return 'hardening';
  return 'next_agent';
}

function sessionActionFromIntent(intent: string): 'current' | 'touched' | 'events' {
  const text = intent.toLowerCase();
  if (/\b(?:event|events|history|log|logs|timeline)\b/.test(text)) return 'events';
  if (/\b(?:current|summary|status)\b/.test(text)) return 'current';
  return 'touched';
}

function sessionCommandFromAction(action: string): string {
  if (action === 'events') return 'projscan session events --format json';
  if (action === 'current') return 'projscan session --format json';
  return 'projscan session touched --format json';
}

function couplingDirectionFromIntent(
  intent: string,
): 'cycles_only' | 'high_fan_in' | 'high_fan_out' | undefined {
  const text = intent.toLowerCase();
  if (/\b(?:circular|cycle|cycles)\b/.test(text)) return 'cycles_only';
  if (/\bfan[-\s]?in\b|\bdepended\s+on\b|\bmost\s+depended\b/.test(text)) return 'high_fan_in';
  if (/\bfan[-\s]?out\b/.test(text)) return 'high_fan_out';
  return undefined;
}

function couplingCommandFromArgs(args: Record<string, unknown>): string {
  const direction = typeof args.direction === 'string' ? args.direction : 'all';
  if (direction === 'cycles_only') return 'projscan coupling --cycles-only --format json';
  if (direction === 'high_fan_in') return 'projscan coupling --high-fan-in --format json';
  if (direction === 'high_fan_out') return 'projscan coupling --high-fan-out --format json';
  return 'projscan coupling --format json';
}

function isClaimListIntent(intent: string): boolean {
  const text = intent.toLowerCase();
  return (
    /\b(?:show|list|view|active)\b/.test(text) && /\b(?:claim|claims|lease|leases)\b/.test(text)
  );
}

function understandViewFromIntent(intent: string): UnderstandView {
  return UNDERSTAND_VIEW_RULES.find((rule) => rule.matches(intent.toLowerCase()))?.view ?? 'map';
}

function isVerificationPlanningIntent(text: string): boolean {
  return (
    !hasRegressionOrFailureContext(text) &&
    !isCoverageLookupWithoutProofSignal(text) &&
    !hasCoverageGapContext(text) &&
    hasVerificationPlanningSignals(text)
  );
}

function hasRegressionOrFailureContext(text: string): boolean {
  return /\b(?:smoke|focused|full|regression|fail|failing|failed|failure|failures|error|errors|broken|debug|flake|flaky|slow|slower|reproduce|quarantine)\b/.test(
    text,
  );
}

function isCoverageLookupWithoutProofSignal(text: string): boolean {
  return (
    !hasProofSelectionSignal(text) &&
    /\b(?:which|what|where|find|locate|search)\b.*\b(?:tests?|specs?)\b.*\b(?:cover|covers|covering|for)\b/.test(
      text,
    )
  );
}

function hasCoverageGapContext(text: string): boolean {
  return /\b(?:coverage|scariest|untested|uncovered|gap|gaps|missing\s+tests?|no\s+tests?)\b/.test(
    text,
  );
}

function hasVerificationPlanningSignals(text: string): boolean {
  const testSubject =
    /\b(?:tests?|specs?|e2e|unit|integration|lint|typecheck|typechecking|build)\b/.test(text);
  const proofSignal = /\b(?:verify|verification|proof|prove|checks?)\b/.test(text);
  const gateSignal = /\b(?:before|push|pushing|commit|committing|review|merge|pr)\b/.test(text);
  const shouldSignal = /\b(?:should|need|needs|must)\b/.test(text);
  return (
    (testSubject && (shouldSignal || gateSignal || proofSignal)) || (proofSignal && gateSignal)
  );
}

function hasProofSelectionSignal(text: string): boolean {
  return /\b(?:run|should|need|needs|must|before|push|pushing|prove|proof|verify|verification|checks?)\b/.test(
    text,
  );
}

function isPackageScriptDiscoveryIntent(text: string): boolean {
  if (
    /\b(?:fail|failing|failed|failure|failures|error|errors|broken|debug|flake|flaky|slow|rerun|reproduce|quarantine)\b/.test(
      text,
    )
  ) {
    return false;
  }
  const scriptTarget =
    /\b(?:tests?|e2e|unit|integration|storybook|cypress|playwright|eslint|prettier|format|lint|typecheck|typechecking|build)\b/.test(
      text,
    );
  const scriptSubject = /\b(?:scripts?|commands?)\b/.test(text);
  const runSignal = /\b(?:run|runs|start)\b/.test(text);
  const directScriptTarget =
    /\b(?:e2e|storybook|cypress|playwright|eslint|prettier|format|lint|typecheck|typechecking|build)\b/.test(
      text,
    );
  return (
    /\b(?:npm|package)\s+scripts?\b/.test(text) ||
    (scriptTarget && scriptSubject) ||
    (directScriptTarget && runSignal && !/\bshould\b/.test(text))
  );
}

function isLocalServiceSetupIntent(text: string): boolean {
  if (
    /\b(?:fail|failing|failed|failure|failures|error|errors|broken|connection\s+refused|port|eaddrinuse|permission\s+denied|enoent|eresolve|peer)\b/.test(
      text,
    )
  ) {
    return false;
  }
  const action = /\b(?:run|runs|start|starts|command|commands|setup|set\s+up)\b/.test(text);
  const localServices =
    /\b(?:local|locally|dev)\b.*\bservices?\b|\bservices?\b.*\b(?:local|locally|dev)\b/.test(text);
  const dockerCompose = /\bdocker\s+compose\b/.test(text);
  return action && (localServices || dockerCompose);
}
