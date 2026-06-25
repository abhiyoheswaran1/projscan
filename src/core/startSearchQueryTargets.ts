import { unwrapTarget } from './startIntentTargetText.js';
import { searchQueryFromHighPrioritySignals } from './startHighPrioritySearchTargets.js';
import { searchQueryFromTestAndRouteLookups } from './startTestRouteSearchTargets.js';
import { searchQueryFromGeneratedAndConfig } from './startGeneratedConfigSearchTargets.js';
import { searchQueryFromImplementation, searchQueryFromOwnership } from './startOwnershipSearchTargets.js';
import { searchQueryFromDomainSignals } from './startIntentDomainSearchQueries.js';

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
