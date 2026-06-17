import { couplingKeywordMatches } from './intentRouterDependencySignals.js';
import type { KeywordMatchContext } from './intentRouterKeywordContext.js';
import {
  dataAccessPlanningContextMatches,
  domainWorkflowPlanningContextMatches,
  stateManagementPlanningContextMatches,
} from './intentRouterPlanningSignals.js';
import {
  styleSystemFailureContextMatches,
  toolingFailureContextMatches,
} from './intentRouterRegressionSignals.js';
import { localServiceSetupCommandContextMatches } from './intentRouterRepoSignals.js';
import { evidencePackKeywordMatches, reviewKeywordMatches } from './intentRouterReviewSignals.js';
import {
  dataflowKeywordMatches,
  explicitDataflowContextMatches,
  explicitDataflowRiskContextMatches,
  privacyCheckKeywordMatches,
} from './intentRouterSecuritySignals.js';
import { searchApiContractContextMatches } from './intentRouterSearchApiSignals.js';
import { searchBackgroundWorkContextMatches } from './intentRouterSearchBackgroundSignals.js';
import { searchCommunicationArtifactContextMatches } from './intentRouterSearchCommunicationSignals.js';
import {
  searchDataAccessContextMatches,
  searchDataContractContextMatches,
} from './intentRouterSearchDataSignals.js';
import { searchDomainWorkflowContextMatches } from './intentRouterSearchDomainSignals.js';
import { searchInfraArtifactContextMatches } from './intentRouterSearchInfraSignals.js';
import { searchIntegrationContextMatches } from './intentRouterSearchIntegrationSignals.js';
import {
  searchEnvLookupContextMatches,
  searchObservabilityContextMatches,
  searchQuotedDebugTextContextMatches,
} from './intentRouterSearchLookupSignals.js';
import { searchNavigationLayoutContextMatches } from './intentRouterSearchNavigationSignals.js';
import { searchFrontendPageRouteContextMatches } from './intentRouterSearchPageSignals.js';
import { searchReliabilityContextMatches } from './intentRouterSearchReliabilitySignals.js';
import { searchStateManagementContextMatches } from './intentRouterSearchStateSignals.js';
import { searchStyleSystemContextMatches } from './intentRouterSearchStyleSignals.js';
import { searchTestDataContextMatches } from './intentRouterSearchTestSignals.js';
import { searchUiInteractionContextMatches } from './intentRouterSearchUiSignals.js';
import { understandKeywordMatches } from './intentRouterUnderstandSignals.js';

type TokenContextMatcher = (tokens: Set<string>) => boolean;

const UNDERSTAND_CONTEXT_REJECTORS: readonly TokenContextMatcher[] = [
  searchTestDataContextMatches,
  searchDataContractContextMatches,
  searchUiInteractionContextMatches,
  searchIntegrationContextMatches,
  searchApiContractContextMatches,
  searchDomainWorkflowContextMatches,
  searchCommunicationArtifactContextMatches,
  searchStateManagementContextMatches,
  searchDataAccessContextMatches,
  searchNavigationLayoutContextMatches,
  searchFrontendPageRouteContextMatches,
  searchStyleSystemContextMatches,
];

const DATAFLOW_PLANNING_REJECTORS: readonly TokenContextMatcher[] = [
  domainWorkflowPlanningContextMatches,
  stateManagementPlanningContextMatches,
  dataAccessPlanningContextMatches,
];

const DATAFLOW_CONTEXT_REQUIRING_EXPLICIT: readonly TokenContextMatcher[] = [
  searchBackgroundWorkContextMatches,
  searchObservabilityContextMatches,
  searchTestDataContextMatches,
];

const DATAFLOW_CONTEXT_REQUIRING_RISK: readonly TokenContextMatcher[] = [
  searchReliabilityContextMatches,
  searchDataContractContextMatches,
  searchUiInteractionContextMatches,
  searchIntegrationContextMatches,
  searchApiContractContextMatches,
  searchInfraArtifactContextMatches,
  searchDomainWorkflowContextMatches,
  searchCommunicationArtifactContextMatches,
  searchStateManagementContextMatches,
];

const DATAFLOW_SEARCH_CONTEXT_REJECTORS: readonly TokenContextMatcher[] = [
  searchDataAccessContextMatches,
  searchNavigationLayoutContextMatches,
  searchFrontendPageRouteContextMatches,
  searchStyleSystemContextMatches,
];

export function routeKeywordRejectedByEarlyGuards(context: KeywordMatchContext): boolean {
  return (
    privacyKeywordRejected(context) ||
    understandKeywordRejected(context) ||
    reviewKeywordRejected(context) ||
    dataflowKeywordRejected(context)
  );
}

function privacyKeywordRejected({ entry, keyword, tokens }: KeywordMatchContext): boolean {
  if (entry.tool !== 'projscan_privacy_check') return false;
  return (
    searchIntegrationContextMatches(tokens) ||
    searchUiInteractionContextMatches(tokens) ||
    !privacyCheckKeywordMatches(keyword, tokens)
  );
}

function understandKeywordRejected({
  entry,
  keyword,
  tokens,
  hasEnvVar,
  hasQuotedText,
}: KeywordMatchContext): boolean {
  if (entry.tool !== 'projscan_understand') return false;
  if (!understandKeywordMatches(keyword, tokens)) return true;
  if (searchEnvLookupContextMatches(tokens, hasEnvVar)) return true;
  if (searchQuotedDebugTextContextMatches(tokens, hasQuotedText)) return true;
  if (
    searchInfraArtifactContextMatches(tokens) &&
    !localServiceSetupCommandContextMatches(tokens)
  ) {
    return true;
  }
  return UNDERSTAND_CONTEXT_REJECTORS.some((matches) => matches(tokens));
}

function reviewKeywordRejected({ entry, keyword, tokens }: KeywordMatchContext): boolean {
  if (entry.tool === 'projscan_review' && !reviewKeywordMatches(keyword, tokens)) return true;
  if (entry.tool === 'projscan_coupling' && !couplingKeywordMatches(keyword, tokens)) return true;
  if (entry.tool === 'projscan_evidence_pack' && !evidencePackKeywordMatches(keyword, tokens))
    return true;
  return (
    entry.tool === 'projscan_explain_issue' &&
    (styleSystemFailureContextMatches(tokens) || toolingFailureContextMatches(tokens))
  );
}

function dataflowKeywordRejected({
  entry,
  keyword,
  tokens,
  hasEnvVar,
  hasQuotedText,
}: KeywordMatchContext): boolean {
  if (entry.tool !== 'projscan_dataflow') return false;
  if (!dataflowKeywordMatches(keyword, tokens)) return true;
  if (DATAFLOW_PLANNING_REJECTORS.some((matches) => matches(tokens))) return true;
  if (
    ['process', 'processes'].includes(keyword) &&
    searchEnvLookupContextMatches(tokens, hasEnvVar)
  ) {
    return true;
  }
  if (
    searchQuotedDebugTextContextMatches(tokens, hasQuotedText) &&
    !explicitDataflowContextMatches(tokens)
  ) {
    return true;
  }
  if (
    DATAFLOW_CONTEXT_REQUIRING_EXPLICIT.some((matches) => matches(tokens)) &&
    !explicitDataflowContextMatches(tokens)
  ) {
    return true;
  }
  if (
    DATAFLOW_CONTEXT_REQUIRING_RISK.some((matches) => matches(tokens)) &&
    !explicitDataflowRiskContextMatches(tokens)
  ) {
    return true;
  }
  return DATAFLOW_SEARCH_CONTEXT_REJECTORS.some((matches) => matches(tokens));
}
