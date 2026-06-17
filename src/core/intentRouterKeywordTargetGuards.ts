import { packageDependencyLookupContextMatches } from './intentRouterDependencySignals.js';
import type { KeywordMatchContext, KeywordMatchDecision } from './intentRouterKeywordContext.js';
import {
  doctorCleanupDeleteContextMatches,
  fileHistoryContextMatches,
  fileTestContextMatches,
  hotspotWhereContextMatches,
  impactApiContextMatches,
  impactApiKeywordMatches,
  impactDatabaseContextMatches,
  impactDeleteContextMatches,
  impactRollbackContextMatches,
} from './intentRouterRiskSignals.js';
import { searchBackgroundWorkContextMatches } from './intentRouterSearchBackgroundSignals.js';
import {
  searchDataAccessContextMatches,
  searchDataContractContextMatches,
} from './intentRouterSearchDataSignals.js';
import {
  searchAuthorizationContextMatches,
  searchConfigLookupContextMatches,
} from './intentRouterSearchLookupSignals.js';
import { searchNavigationLayoutContextMatches } from './intentRouterSearchNavigationSignals.js';
import { searchFrontendPageRouteContextMatches } from './intentRouterSearchPageSignals.js';
import { searchReliabilityContextMatches } from './intentRouterSearchReliabilitySignals.js';
import { searchStyleSystemContextMatches } from './intentRouterSearchStyleSignals.js';
import { searchTestDataContextMatches } from './intentRouterSearchTestSignals.js';
import { searchToolingConfigContextMatches } from './intentRouterSearchToolingSignals.js';
import { searchUiInteractionContextMatches } from './intentRouterSearchUiSignals.js';

type TokenContextMatcher = (tokens: Set<string>) => boolean;

const HOTSPOT_CONTEXT_REJECTORS: readonly TokenContextMatcher[] = [
  searchUiInteractionContextMatches,
  searchNavigationLayoutContextMatches,
  searchFrontendPageRouteContextMatches,
  searchStyleSystemContextMatches,
];
const FILE_DIRECT_PATH_KEYWORDS = [
  'read',
  'owns',
  'review',
  'reviewer',
  'reviewers',
  'risk',
  'risks',
  'risky',
  'dangerous',
];
const FILE_HISTORY_KEYWORDS = [
  'last',
  'touched',
  'touch',
  'changed',
  'recently',
  'history',
  'author',
  'authors',
  'blame',
];
const FILE_TEST_KEYWORDS = ['add', 'write', 'coverage', 'covered', 'uncovered', 'test', 'tests'];
const IMPACT_USAGE_KEYWORDS = ['used', 'usage', 'referenced', 'called'];
const IMPACT_DATABASE_KEYWORDS = [
  'drop',
  'schema',
  'table',
  'column',
  'database',
  'db',
  'migration',
  'migrations',
];
const IMPACT_ENV_VAR_KEYWORDS = [
  'depends',
  'affect',
  'callers',
  ...IMPACT_USAGE_KEYWORDS,
  'api',
  'apis',
];
const IMPACT_ROLLBACK_KEYWORDS = ['revert', 'rollback', 'undo', 'backout', 'back', 'out', 'recover'];
const SEMANTIC_GRAPH_DEFINED_KEYWORDS = ['defined', 'definition'];
const SEMANTIC_DEFINED_CONTEXT_REJECTORS: readonly TokenContextMatcher[] = [
  searchBackgroundWorkContextMatches,
  searchTestDataContextMatches,
  searchAuthorizationContextMatches,
  searchDataContractContextMatches,
  searchDataAccessContextMatches,
  searchStyleSystemContextMatches,
];

export function routeKeywordTargetGuardDecision(
  context: KeywordMatchContext,
): KeywordMatchDecision {
  return (
    targetKeywordDecision(context) ??
    impactKeywordDecision(context) ??
    semanticKeywordDecision(context) ??
    cleanupKeywordDecision(context)
  );
}

function targetKeywordDecision({
  entry,
  keyword,
  tokens,
  hasFilePath,
}: KeywordMatchContext): KeywordMatchDecision {
  return (
    filePathStartDecision(entry.tool, keyword, hasFilePath) ??
    fileKeywordDecision(entry.tool, keyword, tokens, hasFilePath) ??
    hotspotKeywordDecision(entry.tool, keyword, tokens, hasFilePath)
  );
}

function filePathStartDecision(
  tool: string,
  keyword: string,
  hasFilePath: boolean,
): KeywordMatchDecision {
  if (
    hasFilePath &&
    keyword === 'start' &&
    ['projscan_hotspots', 'projscan_start'].includes(tool)
  )
    return false;
  return undefined;
}

function fileKeywordDecision(
  tool: string,
  keyword: string,
  tokens: Set<string>,
  hasFilePath: boolean,
): KeywordMatchDecision {
  if (tool !== 'projscan_file') return undefined;
  return (
    fileDirectPathDecision(keyword, hasFilePath) ??
    fileHistoryDecision(keyword, tokens, hasFilePath) ??
    fileTestDecision(keyword, tokens, hasFilePath) ??
    fileConfigDecision(keyword, tokens)
  );
}

function fileDirectPathDecision(keyword: string, hasFilePath: boolean): KeywordMatchDecision {
  if (FILE_DIRECT_PATH_KEYWORDS.includes(keyword)) return hasFilePath;
  return undefined;
}

function fileHistoryDecision(
  keyword: string,
  tokens: Set<string>,
  hasFilePath: boolean,
): KeywordMatchDecision {
  if (FILE_HISTORY_KEYWORDS.includes(keyword)) return hasFilePath && fileHistoryContextMatches(tokens);
  return undefined;
}

function fileTestDecision(
  keyword: string,
  tokens: Set<string>,
  hasFilePath: boolean,
): KeywordMatchDecision {
  if (FILE_TEST_KEYWORDS.includes(keyword)) return hasFilePath && fileTestContextMatches(tokens);
  return undefined;
}

function fileConfigDecision(keyword: string, tokens: Set<string>): KeywordMatchDecision {
  if (
    keyword === 'file' &&
    (searchConfigLookupContextMatches(tokens) || searchToolingConfigContextMatches(tokens))
  )
    return false;
  return undefined;
}

function hotspotKeywordDecision(
  tool: string,
  keyword: string,
  tokens: Set<string>,
  hasFilePath: boolean,
): KeywordMatchDecision {
  if (tool !== 'projscan_hotspots') return undefined;
  if (HOTSPOT_CONTEXT_REJECTORS.some((matches) => matches(tokens))) return false;
  if (['where', 'start'].includes(keyword) && !hotspotWhereContextMatches(tokens, hasFilePath))
    return false;
  return undefined;
}

function impactKeywordDecision({
  entry,
  keyword,
  tokens,
  hasFilePath,
  hasEnvVar,
}: KeywordMatchContext): KeywordMatchDecision {
  if (entry.tool !== 'projscan_impact') return undefined;
  return (
    impactDeleteDecision(keyword, tokens, hasFilePath) ??
    impactEnvVarDecision(keyword, hasEnvVar) ??
    impactUsageDecision(keyword, tokens) ??
    impactDatabaseDecision(keyword, tokens) ??
    impactApiDecision(keyword, tokens) ??
    impactRollbackDecision(keyword, tokens)
  );
}

function impactDeleteDecision(
  keyword: string,
  tokens: Set<string>,
  hasFilePath: boolean,
): KeywordMatchDecision {
  if (['delete', 'remove'].includes(keyword) && !hasFilePath && !impactDeleteContextMatches(tokens))
    return false;
  return undefined;
}

function impactEnvVarDecision(keyword: string, hasEnvVar: boolean): KeywordMatchDecision {
  if (hasEnvVar && IMPACT_ENV_VAR_KEYWORDS.includes(keyword)) return false;
  return undefined;
}

function impactUsageDecision(keyword: string, tokens: Set<string>): KeywordMatchDecision {
  if (IMPACT_USAGE_KEYWORDS.includes(keyword) && searchTestDataContextMatches(tokens)) return false;
  if (IMPACT_USAGE_KEYWORDS.includes(keyword) && searchReliabilityContextMatches(tokens))
    return false;
  return undefined;
}

function impactDatabaseDecision(keyword: string, tokens: Set<string>): KeywordMatchDecision {
  if (IMPACT_DATABASE_KEYWORDS.includes(keyword) && searchDataContractContextMatches(tokens))
    return false;
  if (IMPACT_DATABASE_KEYWORDS.includes(keyword) && !impactDatabaseContextMatches(tokens))
    return false;
  return undefined;
}

function impactApiDecision(keyword: string, tokens: Set<string>): KeywordMatchDecision {
  if (impactApiKeywordMatches(keyword) && !impactApiContextMatches(tokens)) return false;
  return undefined;
}

function impactRollbackDecision(keyword: string, tokens: Set<string>): KeywordMatchDecision {
  if (
    IMPACT_ROLLBACK_KEYWORDS.includes(keyword) &&
    !impactRollbackContextMatches(keyword, tokens)
  )
    return false;
  return undefined;
}

function semanticKeywordDecision({
  entry,
  keyword,
  tokens,
  hasFilePath,
}: KeywordMatchContext): KeywordMatchDecision {
  if (entry.tool !== 'projscan_semantic_graph') return undefined;
  if (
    ['uses', 'depend', 'depends', 'installed'].includes(keyword) &&
    !packageDependencyLookupContextMatches(tokens, hasFilePath)
  )
    return false;
  if (!SEMANTIC_GRAPH_DEFINED_KEYWORDS.includes(keyword)) return undefined;
  if (SEMANTIC_DEFINED_CONTEXT_REJECTORS.some((matches) => matches(tokens))) return false;
  return undefined;
}

function cleanupKeywordDecision({
  entry,
  keyword,
  tokens,
  hasFilePath,
  hasPackageRemoval,
}: KeywordMatchContext): KeywordMatchDecision {
  if (
    entry.tool === 'projscan_doctor' &&
    ['safe', 'safely', 'delete', 'remove'].includes(keyword) &&
    !doctorCleanupDeleteContextMatches(tokens, hasFilePath, hasPackageRemoval)
  )
    return false;
  return undefined;
}
