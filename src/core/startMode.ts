import { routeIntent, type RouteMatch } from './intentRouter.js';
import { isProductPlanningWorkplanRoute } from './startSuccessCriteria.js';
import { isWorkplanMode } from './workplan.js';
import type { StartModeSource, StartRoutedIntent } from '../types/start.js';
import type { WorkplanMode } from '../types/workplan.js';

export interface StartModeResolution {
  mode: WorkplanMode;
  source: StartModeSource;
  reason: string;
}

interface ModeResolverContext {
  intent: string;
  routes: StartRoutedIntent[];
  primaryRoute?: StartRoutedIntent;
}

type ModeResolver = (context: ModeResolverContext) => WorkplanMode | undefined;

export type StartModeInput = WorkplanMode | 'before_handoff';

const MODE_RESOLVERS: readonly ModeResolver[] = [
  releaseMode,
  bugHuntMode,
  productPlanningMode,
  handoffMode,
  agentPlanningMode,
  prohibitedContinuationMode,
  hardeningMode,
  evidencePackMode,
  reviewMode,
  regressionMode,
  prDiffMode,
  mergeRiskMode,
  primaryPreflightMode,
  fallbackPreflightMode,
];

export function resolveStartMode(
  value: StartModeInput | undefined,
  intent: string | undefined,
): StartModeResolution {
  const explicitMode = typeof value === 'string' ? normalizeStartModeInput(value) : undefined;
  if (explicitMode) {
    return {
      mode: explicitMode,
      source: 'explicit',
      reason:
        explicitMode === value
          ? `Mode ${value} was provided explicitly.`
          : `Mode ${value} was provided explicitly and maps to ${explicitMode}.`,
    };
  }
  const inferred = inferModeFromIntent(intent);
  if (inferred) {
    return {
      mode: inferred,
      source: 'intent',
      reason: `Intent "${intent}" maps to the ${inferred} workflow.`,
    };
  }
  return {
    mode: 'before_edit',
    source: 'default',
    reason: defaultModeReason(intent, routesForIntent(intent).length > 0),
  };
}

export function isStartModeInput(value: string): value is StartModeInput {
  return normalizeStartModeInput(value) !== undefined;
}

function normalizeStartModeInput(value: string): WorkplanMode | undefined {
  if (value === 'before_handoff') return 'before_commit';
  return isWorkplanMode(value) ? value : undefined;
}

export function inferModeFromIntent(intent: string | undefined): WorkplanMode | undefined {
  const routes = routesForIntent(intent);
  const context: ModeResolverContext = {
    intent: intent ?? '',
    routes,
    primaryRoute: routes[0],
  };
  for (const resolver of MODE_RESOLVERS) {
    const mode = resolver(context);
    if (mode) return mode;
  }
  return undefined;
}

export function routesForIntent(intent: string | undefined): StartRoutedIntent[] {
  if (!intent) return [];
  return routeIntent(intent).matches.map(routeEntryToStartIntent);
}

export function preflightModeFromIntent(
  intent: string,
): 'before_edit' | 'before_commit' | 'before_merge' {
  const text = intent.toLowerCase();
  if (
    !hasProhibitedWorkflowModeAction(intent) &&
    /\b(?:merge|merged|merging|release|rebase|rebasing|conflict|conflicts|resolve|resolving)\b/.test(
      text,
    )
  )
    return 'before_merge';
  if (
    /\b(?:commit|committing|committed|pr|pull\s+request)\b/.test(text) ||
    handoffIntentMatches(text)
  )
    return 'before_commit';
  return 'before_edit';
}

function defaultModeReason(intent: string | undefined, routed: boolean): string {
  if (!intent)
    return 'No mode-specific intent or explicit mode was supplied, so start defaults to before_edit.';
  if (routed) {
    return `Mission Control routed the intent, but no workflow-mode hint matched "${intent}", so start defaults to before_edit.`;
  }
  return `No mode-specific intent matched "${intent}", so start defaults to before_edit.`;
}

function routeEntryToStartIntent(entry: RouteMatch): StartRoutedIntent {
  return {
    intent: entry.intent,
    category: entry.category,
    tool: entry.tool,
    cli: entry.cli,
    why: entry.why,
    example: entry.example,
    confidence: entry.confidence,
    rank: entry.rank,
    score: entry.score,
    matchedKeywords: entry.matchedKeywords,
  };
}

function releaseMode({ intent, primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  if (hasProhibitedWorkflowModeAction(intent)) return undefined;
  return primaryRoute?.tool === 'projscan_release_train' ? 'release' : undefined;
}

function bugHuntMode({ primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_bug_hunt' && primaryRoute.confidence === 'high'
    ? 'bug_hunt'
    : undefined;
}

function productPlanningMode({ primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return isProductPlanningWorkplanRoute(primaryRoute) ? 'bug_hunt' : undefined;
}

function handoffMode({ intent, primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_agent_brief' && handoffIntentMatches(intent)
    ? 'before_commit'
    : undefined;
}

function agentPlanningMode({ primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_workplan' && primaryRoute.confidence === 'high'
    ? 'before_edit'
    : undefined;
}

function prohibitedContinuationMode({ intent }: ModeResolverContext): WorkplanMode | undefined {
  if (!hasProhibitedWorkflowModeAction(intent)) return undefined;
  return hasContinuationPlanningHint(intent) ? 'before_edit' : undefined;
}

function hardeningMode({ primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_dataflow' && primaryRoute.confidence === 'high'
    ? 'hardening'
    : undefined;
}

function evidencePackMode({ intent, primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  if (primaryRoute?.tool !== 'projscan_evidence_pack' && primaryRoute?.tool !== 'projscan_analyze') {
    return undefined;
  }
  return releaseCandidateReviewIntentMatches(intent) ? 'before_merge' : 'before_commit';
}

function reviewMode({ intent, primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_review' ? reviewModeFromIntent(intent) : undefined;
}

function regressionMode({ intent, primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_regression_plan'
    ? regressionModeFromIntent(intent)
    : undefined;
}

function prDiffMode({ primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_pr_diff' ? 'before_commit' : undefined;
}

function mergeRiskMode({ primaryRoute }: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_merge_risk' ? 'before_merge' : undefined;
}

function primaryPreflightMode({
  intent,
  primaryRoute,
}: ModeResolverContext): WorkplanMode | undefined {
  return primaryRoute?.tool === 'projscan_preflight' ? preflightModeFromIntent(intent) : undefined;
}

function fallbackPreflightMode({ intent, routes }: ModeResolverContext): WorkplanMode | undefined {
  if (routes.some((route) => route.tool === 'projscan_preflight') && hasPreflightModeHint(intent)) {
    return preflightModeFromIntent(intent);
  }
  return undefined;
}

function hasPreflightModeHint(intent: string): boolean {
  return (
    /\b(?:safe|safety|gate|preflight|commit|committing|committed|merge|merged|merging|rebase|rebasing|conflict|conflicts|resolve|resolving|edit|proceed|block|blocked|blocker|blockers|blocking|allowed)\b/i.test(
      intent,
    ) || handoffIntentMatches(intent)
  );
}

function hasContinuationPlanningHint(intent: string): boolean {
  return /\b(?:keep\s+going|keep\s+(?:improving|working|implementing)|continue|continuing|go\s+on|improve|improving|implement|implementing|implementation|roadmap|user\s+research)\b/i.test(
    intent,
  );
}

function handoffIntentMatches(intent: string): boolean {
  return /\b(?:handoff|handover|hand\s+off)\b/i.test(intent);
}

function releaseCandidateReviewIntentMatches(intent: string): boolean {
  return (
    /\brelease[-\s]+candidate\b/i.test(intent) &&
    /\b(?:review|approval|readiness|evidence|prepare|prepared|preparing)\b/i.test(intent)
  );
}

export function hasProhibitedWorkflowModeAction(intent: string): boolean {
  return (
    /\bno(?:[-\s]+more)?[-\s]+(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping|version[-\s]+bump|bump)\b/i.test(
      intent,
    ) ||
    /\b(?:do\s+not|don't|dont|never)\b[^.?!\n]*(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping|bump(?:ing)?(?:\s+the)?\s+version|version\s+bump)\b/i.test(
      intent,
    ) ||
    /\bwithout\b[^.?!\n]*(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping|bump(?:ing)?(?:\s+the)?\s+version|version\s+bump)\b/i.test(
      intent,
    )
  );
}

function regressionModeFromIntent(intent: string): 'before_commit' | 'before_merge' {
  return /\bmerge|merged|merging|release\b/i.test(intent) ? 'before_merge' : 'before_commit';
}

function reviewModeFromIntent(intent: string): 'before_commit' | 'before_merge' {
  return /\bmerge|merged|merging\b/i.test(intent) ? 'before_merge' : 'before_commit';
}
