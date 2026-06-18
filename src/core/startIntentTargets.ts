import { unwrapTarget } from './startIntentTargetText.js';
import { searchQueryFromHighPrioritySignals } from './startHighPrioritySearchTargets.js';
import { searchQueryFromTestAndRouteLookups } from './startTestRouteSearchTargets.js';
import { searchQueryFromGeneratedAndConfig } from './startGeneratedConfigSearchTargets.js';
import { searchQueryFromImplementation, searchQueryFromOwnership } from './startOwnershipSearchTargets.js';
import { searchQueryFromDomainSignals } from './startIntentDomainSearchQueries.js';

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
