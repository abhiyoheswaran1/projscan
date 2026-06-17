import {
  claimKeywordMatches,
  collisionChangeContextMatches,
  collisionConflictContextMatches,
  coordinateActiveContextMatches,
  coordinateAgentContextMatches,
  coordinateConflictContextMatches,
  coordinateWorkingContextMatches,
  mergeRiskKeywordMatches,
  sessionAgentContextMatches,
  sessionAwayContextMatches,
  sessionLeaveOffContextMatches,
} from './intentRouterCoordinationSignals.js';
import {
  auditKeywordMatches,
  dependenciesKeywordMatches,
  dependencyCycleContextMatches,
  outdatedNpmContextMatches,
  packageImporterContextMatches,
  workspacesKeywordMatches,
} from './intentRouterDependencySignals.js';
import type { KeywordMatchContext, KeywordMatchDecision } from './intentRouterKeywordContext.js';
import {
  preflightBranchRecoveryContextMatches,
  preflightReadyContextMatches,
  preflightRiskContextMatches,
} from './intentRouterPreflightSignals.js';
import { prDiffKeywordMatches } from './intentRouterPrDiffSignals.js';
import { regressionKeywordMatches } from './intentRouterRegressionKeywordMatches.js';
import { regressionLocalSetupContextMatches } from './intentRouterRegressionSignals.js';
import { releaseTrainKeywordMatches } from './intentRouterReleaseSignals.js';
import {
  hotspotFileRiskContextMatches,
  hotspotPerformanceContextMatches,
} from './intentRouterRiskSignals.js';
import { searchDataContractContextMatches } from './intentRouterSearchDataSignals.js';
import { searchInfraArtifactContextMatches } from './intentRouterSearchInfraSignals.js';
import { searchToolingConfigContextMatches } from './intentRouterSearchToolingSignals.js';
import { coverageKeywordMatches } from './intentRouterVerificationSignals.js';
import {
  bugHuntOpportunityContextMatches,
  bugHuntSpeedContextMatches,
  protectedImproveNextContextMatches,
  workplanKeywordMatches,
} from './intentRouterWorkSignals.js';

type ToolKeywordRejector = (context: KeywordMatchContext) => boolean;

const PACKAGE_LOOKUP_TOOLS = keywordList('projscan_audit projscan_outdated projscan_upgrade');
const DEPENDENCY_KEYWORDS = keywordList('dependency dependencies package packages');
const UPGRADE_LOCAL_SETUP_KEYWORDS = keywordList('package dependency dependencies npm');
const UPGRADE_REMOVE_KEYWORDS = keywordList('remove drop uninstall');
const PREFLIGHT_RECOVERY_KEYWORDS = keywordList(
  'rebase rebasing conflict conflicts resolve resolving wrong stuck',
);
const HOTSPOT_FILE_KEYWORDS = keywordList('files file touch');
const HOTSPOT_PERFORMANCE_KEYWORDS = keywordList(
  'performance perf bottleneck bottlenecks optimize optimise faster slow',
);
const COORDINATE_WORKING_KEYWORDS = keywordList('who else working');
const COORDINATE_CONFLICT_KEYWORDS = keywordList('conflict conflicts conflicting conflicted');
const SESSION_LEAVE_KEYWORDS = keywordList('leave left off');
const SESSION_AWAY_KEYWORDS = keywordList('away asleep slept offline');
const NEXT_ACTION_TOOLS = keywordList('projscan_workplan projscan_agent_brief');
const BUG_HUNT_SPEED_KEYWORDS = keywordList('fastest quickest quick smallest');
const BUG_HUNT_OPPORTUNITY_KEYWORDS = keywordList(
  'small low lowest improve improvement useful easy beginner starter intern interns task tasks five minutes today win wins',
);
const MERGE_KEYWORDS = keywordList('merge merged merging');
const REPORT_CONTROL_CONTEXT_KEYWORDS = keywordList(
  'redact redacted redaction scoped scope partner vendor external artifact artifacts export exports paths report reports',
);

export function routeKeywordToolGuardDecision(
  context: KeywordMatchContext,
): KeywordMatchDecision {
  return toolKeywordDecision(context);
}

function toolKeywordDecision(context: KeywordMatchContext): KeywordMatchDecision {
  return TOOL_KEYWORD_REJECTORS.some((rejects) => rejects(context)) ? false : undefined;
}

function keywordList(words: string): readonly string[] {
  return words.split(' ');
}

function keywordIn(keyword: string, keywords: readonly string[]): boolean {
  return keywords.includes(keyword);
}

function toolIn(tool: string, tools: readonly string[]): boolean {
  return tools.includes(tool);
}

const TOOL_KEYWORD_REJECTORS: readonly ToolKeywordRejector[] = [
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_pr_diff' && !prDiffKeywordMatches(keyword, tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_coverage' && !coverageKeywordMatches(keyword, tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_dependencies' && !dependenciesKeywordMatches(keyword, tokens),
  ({ entry, keyword, tokens }) =>
    toolIn(entry.tool, PACKAGE_LOOKUP_TOOLS) &&
    keywordIn(keyword, DEPENDENCY_KEYWORDS) &&
    dependencyCycleContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_audit' && !auditKeywordMatches(keyword, tokens),
  ({ entry, tokens }) =>
    entry.tool === 'projscan_workspaces' && searchToolingConfigContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_workspaces' && !workspacesKeywordMatches(keyword, tokens),
  ({ entry, keyword, hasPackageChange }) =>
    entry.tool === 'projscan_upgrade' && keyword === 'update' && !hasPackageChange,
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_upgrade' &&
    keyword === 'package' &&
    packageImporterContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_upgrade' &&
    keywordIn(keyword, UPGRADE_LOCAL_SETUP_KEYWORDS) &&
    regressionLocalSetupContextMatches(tokens),
  ({ entry, keyword, hasPackageRemoval }) =>
    entry.tool === 'projscan_upgrade' &&
    keywordIn(keyword, UPGRADE_REMOVE_KEYWORDS) &&
    !hasPackageRemoval,
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_outdated' &&
    keyword === 'npm' &&
    !outdatedNpmContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_preflight' &&
    keyword === 'ready' &&
    !preflightReadyContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_preflight' &&
    keywordIn(keyword, ['risk', 'risks']) &&
    !preflightRiskContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_preflight' &&
    keywordIn(keyword, PREFLIGHT_RECOVERY_KEYWORDS) &&
    !preflightBranchRecoveryContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_hotspots' &&
    keywordIn(keyword, HOTSPOT_FILE_KEYWORDS) &&
    !hotspotFileRiskContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_hotspots' &&
    keywordIn(keyword, HOTSPOT_PERFORMANCE_KEYWORDS) &&
    !hotspotPerformanceContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_coordinate' &&
    keyword === 'agent' &&
    !coordinateAgentContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_coordinate' &&
    keywordIn(keyword, COORDINATE_WORKING_KEYWORDS) &&
    !coordinateWorkingContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_coordinate' &&
    keyword === 'editing' &&
    !coordinateWorkingContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_coordinate' &&
    keyword === 'active' &&
    !coordinateActiveContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_coordinate' &&
    keywordIn(keyword, COORDINATE_CONFLICT_KEYWORDS) &&
    !coordinateConflictContextMatches(tokens),
  ({ entry, tokens }) =>
    entry.tool === 'projscan_claim' && searchDataContractContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_claim' && !claimKeywordMatches(keyword, tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_collision' &&
    keywordIn(keyword, ['conflict', 'conflicts']) &&
    !collisionConflictContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_collision' &&
    keyword === 'changes' &&
    !collisionChangeContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_merge_risk' && !mergeRiskKeywordMatches(keyword, tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_session' &&
    keywordIn(keyword, SESSION_LEAVE_KEYWORDS) &&
    !sessionLeaveOffContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_session' &&
    keywordIn(keyword, SESSION_AWAY_KEYWORDS) &&
    !sessionAwayContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_session' &&
    keyword === 'agent' &&
    !sessionAgentContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    toolIn(entry.tool, NEXT_ACTION_TOOLS) &&
    keyword === 'next' &&
    protectedImproveNextContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_workplan' && !workplanKeywordMatches(keyword, tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_bug_hunt' &&
    keyword === 'first' &&
    MERGE_KEYWORDS.some((token) => tokens.has(token)),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_bug_hunt' &&
    keywordIn(keyword, BUG_HUNT_SPEED_KEYWORDS) &&
    !bugHuntSpeedContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_bug_hunt' &&
    keywordIn(keyword, BUG_HUNT_OPPORTUNITY_KEYWORDS) &&
    !bugHuntOpportunityContextMatches(tokens),
  ({ entry, keyword, tokens, hasQuotedText }) =>
    entry.tool === 'projscan_regression_plan' &&
    !regressionKeywordMatches(keyword, tokens, hasQuotedText),
  ({ entry, tokens }) =>
    entry.tool === 'projscan_analyze' && !reportControlContextMatches(tokens),
  ({ entry, tokens }) =>
    entry.tool === 'projscan_release_train' && searchInfraArtifactContextMatches(tokens),
  ({ entry, keyword, tokens }) =>
    entry.tool === 'projscan_release_train' && !releaseTrainKeywordMatches(keyword, tokens),
];

function reportControlContextMatches(tokens: Set<string>): boolean {
  return REPORT_CONTROL_CONTEXT_KEYWORDS.some((token) => tokens.has(token));
}
