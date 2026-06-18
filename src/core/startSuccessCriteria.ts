import { FIXED_ROUTE_CRITERIA } from './startFixedRouteCriteria.js';
import { fileSuccessCriteria } from './startFileRouteCriteria.js';
import { regressionSuccessCriteria } from './startRegressionRouteCriteria.js';
import { understandSuccessCriteria } from './startUnderstandRouteCriteria.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
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
  return regressionSuccessCriteria(context.primaryAction, context.route);
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
