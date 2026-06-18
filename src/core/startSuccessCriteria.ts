import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { RegressionPlanLevel } from '../types/regressionPlan.js';
import type { StartRoutedIntent } from '../types/start.js';
import type { WorkplanMode, WorkplanReport } from '../types/workplan.js';

export interface MissionSuccessCriteriaInput {
  mode: WorkplanMode;
  route?: StartRoutedIntent;
  actionPlan: PreflightSuggestedAction[];
  workplan: WorkplanReport;
}

export function isProductPlanningWorkplanRoute(route: StartRoutedIntent | undefined): boolean {
  if (route?.tool !== 'projscan_workplan' || route.confidence !== 'high') return false;
  const keywords = new Set(route.matchedKeywords);
  const planningSignal = [
    'next',
    'plan',
    'workplan',
    'tasks',
    'to' + 'do',
    'prioritize',
    'priorities',
    'roadmap',
    'strategy',
    'strategic',
  ].some((keyword) => keywords.has(keyword));
  const productSignal = ['product', 'products', 'feature', 'features', 'strategy', 'strategic'].some(
    (keyword) => keywords.has(keyword),
  );
  return planningSignal && productSignal;
}

export function actionFromWorkplan(workplan: WorkplanReport): PreflightSuggestedAction | undefined {
  const task = workplan.tasks[0];
  if (!task) return undefined;
  return {
    label: task.title,
    command: task.verification.commands[0],
    tool: task.suggestedTools.find((tool) => tool.startsWith('projscan_')),
  };
}

export function isPreflightAction(action: PreflightSuggestedAction): boolean {
  return (
    action.tool === 'projscan_preflight' ||
    action.command?.startsWith('projscan preflight ') === true
  );
}

export function preflightModeForMission(
  mode: WorkplanMode,
): 'before_edit' | 'before_commit' | 'before_merge' {
  if (mode === 'before_commit') return 'before_commit';
  if (mode === 'hardening') return 'before_commit';
  if (mode === 'before_merge' || mode === 'release') return 'before_merge';
  return 'before_edit';
}

interface MissionCriteriaContext extends MissionSuccessCriteriaInput {
  primaryAction?: PreflightSuggestedAction;
}

type CriteriaResolver = (context: MissionCriteriaContext) => string[] | undefined;

const FIXED_ROUTE_CRITERIA: Record<string, string[]> = {
  projscan_release_train: [
    'Release train readiness has no blockers before packaging or publishing continues.',
    'Changelog, package, SBOM, and provenance evidence are reviewed before a release handoff.',
  ],
  projscan_bug_hunt: [
    'Bug-hunt findings are triaged by severity with a first fix candidate selected.',
    'The selected fix has a runnable verification command before editing starts.',
  ],
  projscan_workplan: [
    'The workplan identifies the first safe implementation or review step before edits begin.',
    'The selected action has a focused verification command before handoff.',
  ],
  projscan_agent_brief: [
    'The agent brief summarizes focus items, repo context, guardrails, and suggested next actions for the next developer.',
    'The handoff includes enough proof commands for the next agent to resume without rerunning broad discovery.',
  ],
  projscan_session: [
    'Remembered touched files and recent session events are reviewed before resuming work.',
    'The current worktree preflight is rerun after session context is reviewed, so stale memory does not override live risk.',
  ],
  projscan_coordinate: [
    'Coordination readiness, collisions, claims, and merge order are reviewed before parallel work continues.',
    'Any conflicted files, contended claims, or merge-order blockers have an owner or follow-up command before editing resumes.',
  ],
  projscan_privacy_check: [
    'Telemetry state, offline mode, scan root, ignored-file handling, .env content policy, plugin execution, local writes, and network-capable endpoints are reviewed.',
    'Any required trust-boundary change is made explicitly before broader analysis or report sharing continues.',
  ],
  projscan_quality_scorecard: [
    'Quality dimensions, top risks, and verification commands are reviewed before choosing the next task.',
    'The developer knows whether health, security, tests, maintainability, or coordination needs attention first.',
  ],
  projscan_review: [
    'The structural PR review reports a verdict and identifies any risk that needs owner follow-up.',
    'Review, preflight, or evidence-pack follow-up is chosen before the branch is handed to reviewers.',
  ],
  projscan_evidence_pack: [
    'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
    'The reviewer-facing comment is validated before it is shared or used for approval.',
  ],
  projscan_analyze: [
    'The scoped analysis, health, and CI artifacts are generated with path redaction enabled before sharing outside the repo.',
    'The reviewer can correlate redacted-path-N labels without seeing raw repo structure.',
  ],
  projscan_doctor: [
    'Dead code, unused exports, lint, dependency, security, and config issues are reviewed before cleanup starts.',
    'Any issue chosen for cleanup has a fix-suggest, impact, or verification follow-up before files are deleted.',
  ],
  projscan_fix_suggest: [
    'A concrete fix suggestion is produced for the selected issue id.',
    'The suggestion names the file, fix instruction, and verification step before editing starts.',
  ],
  projscan_explain_issue: [
    'A deep issue explanation is produced for the selected issue id.',
    'The explanation identifies surrounding code, related issues, similar fixes, and the next fix prompt before editing starts.',
  ],
  projscan_pr_diff: [
    'The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.',
    'The developer knows which changed files or symbols need deeper review.',
  ],
  projscan_coverage: [
    'Coverage gaps are ranked by risk so the next test target is explicit.',
    'The selected file has either a new test plan, an owner, or a documented reason to defer.',
  ],
  projscan_upgrade: [
    'The upgrade preview identifies declared version, installed version, breaking markers, and importers.',
    'Importer files are reviewed before changing the package version.',
  ],
  projscan_audit: [
    'npm audit findings are reviewed for critical, high, moderate, low, and info vulnerabilities.',
    'Any vulnerable dependency has a fix, upgrade preview, or documented deferral before the branch is trusted.',
  ],
  projscan_workspaces: [
    'Monorepo workspace packages are listed with names and relative paths before package-scoped work begins.',
    'The selected workspace name is available for package-scoped follow-up commands such as hotspots, coupling, review, or audit.',
  ],
  projscan_dataflow: [
    'Dataflow findings are reviewed for direct, propagated, and bridge source-to-sink paths.',
    'Any confirmed source-to-sink path has an owner, mitigation, and rerunnable verification command before editing continues.',
  ],
  projscan_semantic_graph: [
    'The targeted graph query answers the importer/import/export question without dumping the full graph.',
    'Any returned files are reviewed before editing the queried file or symbol.',
  ],
  projscan_search: [
    'Search results identify the target files or symbols with enough confidence to choose the next tool.',
  ],
};

const CRITERIA_RESOLVERS: CriteriaResolver[] = [
  preflightSuccessCriteria,
  impactSuccessCriteria,
  productPlanningSuccessCriteria,
  fixedRouteSuccessCriteria,
  understandRouteSuccessCriteria,
  claimRouteSuccessCriteria,
  dependenciesRouteSuccessCriteria,
  regressionRouteSuccessCriteria,
  fileRouteSuccessCriteria,
  couplingRouteSuccessCriteria,
];

export function buildMissionSuccessCriteria(input: MissionSuccessCriteriaInput): string[] {
  const context: MissionCriteriaContext = {
    ...input,
    primaryAction: input.actionPlan[0] ?? actionFromWorkplan(input.workplan),
  };
  const criteria = appendFirstTaskCriteria(criteriaForContext(context), input.workplan);
  const finalCriteria = criteria.length > 0 ? criteria : defaultSuccessCriteria();
  return uniqueStrings(finalCriteria).slice(0, 4);
}

function criteriaForContext(context: MissionCriteriaContext): string[] {
  for (const resolver of CRITERIA_RESOLVERS) {
    const criteria = resolver(context);
    if (criteria) return criteria;
  }
  return [];
}

function appendFirstTaskCriteria(criteria: string[], workplan: WorkplanReport): string[] {
  const firstTaskCommand = workplan.tasks[0]?.verification.commands[0];
  if (!firstTaskCommand) return criteria;
  return [...criteria, `The next task has a verification command: ${firstTaskCommand}`];
}

function defaultSuccessCriteria(): string[] {
  return [
    'The primary action returns useful JSON and identifies the next concrete developer step.',
    'At least one proof command is available before handing work to the next agent or human.',
  ];
}

function preflightSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  if (
    context.route?.tool !== 'projscan_preflight' &&
    !(context.primaryAction && isPreflightAction(context.primaryAction))
  ) {
    return undefined;
  }
  const preflightMode =
    context.route?.tool === 'projscan_preflight' &&
    context.primaryAction?.args &&
    'mode' in context.primaryAction.args
      ? String(context.primaryAction.args.mode)
      : preflightModeForMission(context.mode);
  return [
    `projscan preflight --mode ${preflightMode} returns proceed or only documented manual-review items.`,
    'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
  ];
}

function impactSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  if (context.route?.tool !== 'projscan_impact') return undefined;
  return [
    ...(context.primaryAction?.tool === 'projscan_search'
      ? [
          'An exact symbol or file path is selected from search results before impact analysis continues.',
        ]
      : []),
    'The impact report is reviewed for direct and transitive dependents before editing starts.',
    'Affected call sites, tests, or owners are added to the workplan before code changes begin.',
  ];
}

function productPlanningSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  if (context.mode !== 'bug_hunt' || !isProductPlanningWorkplanRoute(context.route))
    return undefined;
  return [
    'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
    'The selected slice has a runnable verification command before implementation starts.',
    'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
  ];
}

function fixedRouteSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  return context.route ? FIXED_ROUTE_CRITERIA[context.route.tool] : undefined;
}

function understandRouteSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  if (context.route?.tool !== 'projscan_understand') return undefined;
  return understandSuccessCriteria(context.primaryAction, context.route);
}

function claimRouteSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  if (context.route?.tool !== 'projscan_claim') return undefined;
  const hasAddAction = context.actionPlan.some(
    (action) => action.args && 'action' in action.args && action.args.action === 'add',
  );
  if (hasAddAction) {
    return [
      'Active claims are reviewed before a new file, directory, or symbol claim is added.',
      'The target is claimed with a real agent name, and any returned contention is assigned or resolved before parallel editing continues.',
    ];
  }
  return [
    'Active claims, owners, leases, and contention warnings are reviewed before parallel work continues.',
    'Any stale or contended claim has a release, owner, or coordination follow-up before editing resumes.',
  ];
}

function dependenciesRouteSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  if (context.route?.tool !== 'projscan_dependencies') return undefined;
  const criteria: string[] = [];
  if (
    context.route.matchedKeywords.some((keyword) =>
      [
        'license',
        'licenses',
        'gpl',
        'copyleft',
        'notice',
        'notices',
        'third',
        'party',
        'open',
        'source',
        'compliance',
      ].includes(keyword),
    )
  ) {
    criteria.push(
      'Dependency license counts, unknown licenses, and copyleft risks are reviewed before third-party notices or compliance sign-off.',
    );
  }
  if (
    context.route.matchedKeywords.some((keyword) =>
      [
        'bundle',
        'bundles',
        'size',
        'sizes',
        'large',
        'heavy',
        'bloat',
        'bloated',
        'weight',
        'footprint',
        'reduce',
        'slim',
      ].includes(keyword),
    )
  ) {
    criteria.push(
      'Installed package-size totals and largest packages are reviewed before bundle-size or dependency-bloat work starts.',
    );
  }
  criteria.push(
    'Declared production and development dependencies are inventoried before package changes are planned.',
  );
  criteria.push(
    'Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.',
  );
  return criteria;
}

function regressionRouteSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  if (context.route?.tool !== 'projscan_regression_plan') return undefined;
  const level = regressionLevelFromPrimaryAction(context.primaryAction);
  return [
    regressionPlanCriterion(level, context.route),
    'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
  ];
}

function fileRouteSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  return context.route?.tool === 'projscan_file' ? fileSuccessCriteria(context.route) : undefined;
}

function couplingRouteSuccessCriteria(context: MissionCriteriaContext): string[] | undefined {
  if (context.route?.tool !== 'projscan_coupling') return undefined;
  const direction =
    context.primaryAction?.args && 'direction' in context.primaryAction.args
      ? String(context.primaryAction.args.direction)
      : 'all';
  return [
    direction === 'cycles_only'
      ? 'Circular-import cycles are reviewed with the exact files participating in each strongly connected component.'
      : 'Fan-in, fan-out, instability, cross-package edges, and circular-import cycles are reviewed before refactoring boundaries.',
    'Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.',
  ];
}

interface FileCriteriaRule {
  keywords?: string[];
  matches?: (matched: Set<string>) => boolean;
  criterion: string;
}

const FILE_CRITERIA_RULES: FileCriteriaRule[] = [
  {
    keywords: ['risk', 'risks', 'risky', 'dangerous'],
    criterion:
      'Hotspot reasons, related issues, imports, exports, and ownership explain why the file is risky.',
  },
  {
    keywords: [
      'last',
      'touched',
      'touch',
      'changed',
      'recently',
      'history',
      'author',
      'authors',
      'blame',
    ],
    criterion:
      'Primary author, recent history, and ownership signals are reviewed before routing reviewers or changing the file.',
  },
  {
    keywords: ['coverage', 'covered', 'uncovered', 'test', 'tests'],
    criterion:
      'Coverage, hotspot risk, and related test evidence for the file are reviewed before editing starts.',
  },
  {
    matches: matchesFileTestDesignCriteria,
    criterion:
      'File purpose, risky functions, coverage, and existing test evidence are reviewed before designing a new test.',
  },
  {
    keywords: ['read'],
    criterion:
      'Purpose, imports, exports, ownership, tests, and risk are reviewed before changing the named file.',
  },
  {
    keywords: ['review', 'reviewer', 'reviewers'],
    criterion:
      'Ownership, primary author, hotspot risk, and related issues are reviewed before choosing a reviewer.',
  },
];

const UNDERSTAND_VIEW_CRITERIA: Record<string, string[]> = {
  flow: [
    'Runtime entrypoints, flow paths, and side-effect evidence are reviewed before changing request or execution paths.',
    'The developer knows which files sit on the relevant runtime path.',
  ],
  verify: [
    'Verification tiers, direct-test gaps, and likely proof commands are reviewed before pushing or asking for review.',
    'The developer has the smallest rerunnable command plus the fallback full gate for the intended change.',
  ],
  change: [
    'Change-readiness risks, blast radius, and verification tiers are reviewed before editing starts.',
    'The developer knows which follow-up impact, test, or preflight command gates the change.',
  ],
  map: [
    'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
    'The developer has a cited repo map and knows which files to inspect next.',
  ],
};

function fileSuccessCriteria(route: StartRoutedIntent): string[] {
  const matched = new Set(route.matchedKeywords);
  return [
    ...FILE_CRITERIA_RULES.filter((rule) => fileCriteriaRuleMatches(rule, matched)).map(
      (rule) => rule.criterion,
    ),
    'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
    'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
  ];
}

function fileCriteriaRuleMatches(rule: FileCriteriaRule, matched: Set<string>): boolean {
  if (rule.matches) return rule.matches(matched);
  return (rule.keywords ?? []).some((keyword) => matched.has(keyword));
}

function matchesFileTestDesignCriteria(matched: Set<string>): boolean {
  const explicitAuthoring = ['add', 'write'].some((keyword) => matched.has(keyword));
  const testWithoutCoverage =
    matched.has('test') &&
    !['coverage', 'covered', 'uncovered'].some((keyword) => matched.has(keyword));
  return explicitAuthoring || testWithoutCoverage;
}

function understandSuccessCriteria(
  primaryAction: PreflightSuggestedAction | undefined,
  route?: StartRoutedIntent,
): string[] {
  const view =
    primaryAction?.args && 'view' in primaryAction.args ? String(primaryAction.args.view) : 'map';
  if (view === 'contracts')
    return contractUnderstandSuccessCriteria(new Set(route?.matchedKeywords ?? []));
  return UNDERSTAND_VIEW_CRITERIA[view] ?? UNDERSTAND_VIEW_CRITERIA.map;
}

function contractUnderstandSuccessCriteria(matched: Set<string>): string[] {
  if (contractLocalServiceSetupCriteriaMatches(matched)) {
    return [
      'Local service startup scripts, container commands, and required config are reviewed before running dev services.',
      'The developer knows the safest command to start local services plus any env, port, or dependency preconditions.',
    ];
  }
  if (contractScriptDiscoveryCriteriaMatches(matched)) {
    return [
      'Package scripts, test commands, and config contracts are reviewed before running local commands.',
      'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
    ];
  }
  if (contractDatabaseSetupCriteriaMatches(matched)) {
    return [
      'Package scripts and config contracts identify the seed, reset, or migration command before shell commands are guessed.',
      'The developer knows database setup preconditions, required env vars, and the safest local command to run.',
    ];
  }
  if (contractEnvCriteriaMatches(matched)) {
    return [
      'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
      'The developer knows which env names, defaults, or config files need local values before running the app.',
    ];
  }
  return [
    'Public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces.',
    'The developer knows which exported files or symbols need compatibility checks.',
  ];
}

function contractScriptDiscoveryCriteriaMatches(matched: Set<string>): boolean {
  return [
    'npm',
    'script',
    'scripts',
    'e2e',
    'unit',
    'integration',
    'storybook',
    'cypress',
    'playwright',
    'eslint',
    'prettier',
    'format',
    'lint',
    'typecheck',
    'typechecking',
  ].some((keyword) => matched.has(keyword));
}

function contractLocalServiceSetupCriteriaMatches(matched: Set<string>): boolean {
  const action = ['run', 'runs', 'start', 'command', 'commands', 'setup'].some((keyword) =>
    matched.has(keyword),
  );
  const localServices =
    ['local', 'locally', 'dev'].some((keyword) => matched.has(keyword)) &&
    ['service', 'services', 'server', 'app'].some((keyword) => matched.has(keyword));
  const dockerCompose = matched.has('docker') && matched.has('compose');
  return action && (localServices || dockerCompose);
}

function contractDatabaseSetupCriteriaMatches(matched: Set<string>): boolean {
  return (
    ['database', 'db', 'migration', 'migrations'].some((keyword) => matched.has(keyword)) &&
    ['seed', 'seeds', 'reset', 'resets', 'migrate', 'migrates', 'run', 'runs', 'command'].some(
      (keyword) => matched.has(keyword),
    )
  );
}

function contractEnvCriteriaMatches(matched: Set<string>): boolean {
  return [
    'env',
    'environment',
    'environments',
    'vars',
    'variable',
    'variables',
    'missing',
    'required',
  ].some((keyword) => matched.has(keyword));
}

function regressionLevelFromPrimaryAction(
  primaryAction: PreflightSuggestedAction | undefined,
): RegressionPlanLevel {
  const level =
    primaryAction?.args && 'level' in primaryAction.args
      ? String(primaryAction.args.level)
      : 'focused';
  if (level === 'smoke' || level === 'focused' || level === 'full') return level;
  return 'focused';
}

function regressionPlanCriterion(level: RegressionPlanLevel, route?: StartRoutedIntent): string {
  if (level === 'smoke')
    return 'The smoke regression plan identifies the smallest health and preflight commands to rerun.';
  if (level === 'full')
    return 'The full regression plan identifies release-grade build, lint, stability, and test commands to rerun.';
  if (
    route &&
    route.matchedKeywords.some((keyword) =>
      [
        'production',
        'prod',
        'down',
        'outage',
        'incident',
        'triage',
        'runtime',
        'crash',
        'crashes',
        'crashing',
        '500',
        '502',
        '503',
        '504',
        '404',
        '403',
        '401',
      ].includes(keyword),
    )
  ) {
    return 'The focused regression plan identifies the smallest high-signal commands to reproduce and verify the failure.';
  }
  if (
    route &&
    route.matchedKeywords.some((keyword) =>
      [
        'connection',
        'refused',
        'port',
        'ports',
        'eaddrinuse',
        'listen',
        'address',
        'permission',
        'denied',
        'enoent',
        'eresolve',
        'peer',
      ].includes(keyword),
    )
  ) {
    return 'The focused regression plan identifies the local setup command, environment symptom, and smallest rerun proof for the blocker.';
  }
  return 'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.';
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
