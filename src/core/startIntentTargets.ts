import { extractEnvVarTarget } from './startEnvTargets.js';
import { extractFileTarget } from './startFileTargets.js';
import { unwrapTarget } from './startIntentTargetText.js';
import { extractQuotedTextTarget } from './startQuotedTextTargets.js';
import { searchQueryFromTestAndRouteLookups } from './startTestRouteSearchTargets.js';
import { searchQueryFromGeneratedAndConfig } from './startGeneratedConfigSearchTargets.js';
import { searchQueryFromImplementation, searchQueryFromOwnership } from './startOwnershipSearchTargets.js';
import { extractApiContractQuery } from './startIntentApiContractQueries.js';
import { extractAuthorizationQuery } from './startIntentAuthorizationQueries.js';
import { extractBackgroundWorkQuery } from './startIntentBackgroundWorkQueries.js';
import { extractCommunicationArtifactQuery } from './startIntentCommunicationArtifactQueries.js';
import { extractDataAccessQuery } from './startIntentDataAccessQueries.js';
import { extractDataContractQuery } from './startIntentDataContractQueries.js';
import { extractDomainWorkflowQuery } from './startIntentDomainWorkflowQueries.js';
import { extractFrontendPageRouteQuery } from './startIntentFrontendPageRouteQueries.js';
import { extractInfraArtifactQuery } from './startIntentInfraArtifactQueries.js';
import { extractIntegrationQuery } from './startIntentIntegrationQueries.js';
import { extractNavigationLayoutQuery } from './startIntentNavigationLayoutQueries.js';
import { extractObservabilityQuery } from './startIntentObservabilityQueries.js';
import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';
import { extractStateManagementQuery } from './startIntentStateManagementQueries.js';
import { extractStyleSystemQuery } from './startIntentStyleSystemQueries.js';
import { extractTestDataQuery } from './startIntentTestDataQueries.js';
import { extractUiInteractionQuery } from './startIntentUiInteractionQueries.js';

type QueryExtractor = (intent: string) => string | undefined;

export type { StartGraphQuery } from './startGraphTargets.js';
export { graphQueryFromIntent, graphQueryIsReady, semanticGraphCommand } from './startGraphTargets.js';
export { extractFileTarget, isFilePathTarget } from './startFileTargets.js';
export { extractImpactTarget } from './startImpactTargets.js';
export { extractClaimAgent, extractClaimTarget } from './startClaimTargets.js';
export { extractReportScopeTarget } from './startReportScopeTargets.js';
export { extractAuditPackageTarget, extractPackageTarget } from './startPackageTargets.js';
export { extractIssueIdTarget } from './startIssueTargets.js';
export { isExactSymbolTarget } from './startSymbolTargets.js';
export { escapeDoubleQuoted, isPlaceholder, quoteShellArg, quoteShellArgOrPlaceholder } from './startShellArgs.js';

function firstQuery(intent: string, extractors: readonly QueryExtractor[]): string | undefined {
  for (const extract of extractors) {
    const query = extract(intent);
    if (query) return query;
  }
  return undefined;
}

export function extractSearchQuery(intent: string): string {
  const trimmed = intent.trim();
  return (
    searchQueryFromHighPrioritySignals(trimmed) ??
    searchQueryFromDomainSignals(trimmed) ??
    searchQueryFromTestAndRouteLookups(trimmed) ??
    searchQueryFromGeneratedAndConfig(trimmed) ??
    searchQueryFromOwnership(trimmed) ??
    searchQueryFromImplementation(trimmed) ??
    unwrapTarget(
      (trimmed.match(/\b(?:search|find|locate|lookup)\s+(?:for\s+)?(.+)$/i)?.[1] ?? trimmed).trim(),
    )
  );
}

function searchQueryFromHighPrioritySignals(trimmed: string): string | undefined {
  const file = extractFileTarget(trimmed);
  if (file && /\b(?:where|find|locate|search)\b/i.test(trimmed) && /\btests?\b/i.test(trimmed)) {
    return `tests for ${file}`;
  }
  const envVar = extractEnvVarTarget(trimmed);
  if (envVar && /\b(?:where|find|locate|search|lookup|used|referenced|process)\b/i.test(trimmed)) {
    return envVar;
  }
  const envControl = trimmed.match(
    /\b(?:which|what|where|find|locate|search(?:\s+for)?|lookup)\s+(?:env(?:ironment)?\s+)?(?:var|vars|variable|variables)\s+(?:controls?|configures?|sets?|for)\s+(.+?)\s*[?!.]*$/i,
  );
  if (envControl?.[1]) return `${unwrapTarget(envControl[1].trim())} env var`;
  const quotedDebugText = extractQuotedTextTarget(trimmed);
  if (
    quotedDebugText &&
    /\b(?:error|errors|message|messages|throws?|thrown|logs?|logged|logging)\b/i.test(trimmed)
  ) {
    return quotedDebugText;
  }
  return undefined;
}

function searchQueryFromDomainSignals(trimmed: string): string | undefined {
  return firstQuery(trimmed, [
    extractObservabilityQuery,
    extractBackgroundWorkQuery,
    extractTestDataQuery,
    extractAuthorizationQuery,
    extractReliabilityQuery,
    extractDataContractQuery,
    extractUiInteractionQuery,
    extractStyleSystemQuery,
    extractNavigationLayoutQuery,
    extractFrontendPageRouteQuery,
    extractStateManagementQuery,
    extractDataAccessQuery,
    extractIntegrationQuery,
    extractApiContractQuery,
    extractInfraArtifactQuery,
    extractCommunicationArtifactQuery,
    extractDomainWorkflowQuery,
  ]);
}
