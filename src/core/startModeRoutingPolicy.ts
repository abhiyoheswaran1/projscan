import { routeIntent, type RouteMatch } from './intentRouter.js';
import { isProductPlanningWorkplanRoute } from './startSuccessCriteria.js';
import {
  hasContinuationPlanningHint,
  hasPreflightModeHint,
  handoffIntentMatches,
  hasProhibitedWorkflowModeAction,
  noPublishReleaseReadinessIntentMatches,
  preflightModeFromIntent,
  regressionModeFromIntent,
  releaseCandidateReviewIntentMatches,
  reviewModeFromIntent,
} from './startModeIntentPolicy.js';
import type { StartRoutedIntent } from '../types/start.js';
import type { WorkplanMode } from '../types/workplan.js';

interface ModeResolverContext {
  intent: string;
  routes: StartRoutedIntent[];
  primaryRoute?: StartRoutedIntent;
}

type ModeResolver = (context: ModeResolverContext) => WorkplanMode | undefined;

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

export function inferModeFromStartRoutes(intent: string | undefined): WorkplanMode | undefined {
  const routes = routesForStartIntent(intent);
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

export function routesForStartIntent(intent: string | undefined): StartRoutedIntent[] {
  if (!intent) return [];
  return routeIntent(intent).matches.map(routeEntryToStartIntent);
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
  return releaseCandidateReviewIntentMatches(intent) || noPublishReleaseReadinessIntentMatches(intent)
    ? 'before_merge'
    : 'before_commit';
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
