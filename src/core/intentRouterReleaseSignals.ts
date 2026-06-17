type RouteToolEntry = {
  tool: string;
};

export function hasProhibitedReleaseWorkflowAction(intent: string): boolean {
  return (
    /\bno[-\s]+(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping)\b/i.test(
      intent,
    ) ||
    /\b(?:do\s+not|don't|dont|never)\b[^.?!\n]*(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping)\b/i.test(
      intent,
    ) ||
    /\bwithout\b[^.?!\n]*(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping)\b/i.test(
      intent,
    )
  );
}

export function hasProhibitedVersionBumpAction(intent: string): boolean {
  return (
    /\bno[-\s]+(?:version[-\s]+)?(?:bump|cut)\b/i.test(intent) ||
    /\b(?:do\s+not|don't|dont|never)\b[^.?!\n]*(?:bump(?:ing)?(?:\s+the)?\s+version|version\s+bump|cut(?:ting)?(?:\s+a)?\s+version)\b/i.test(
      intent,
    ) ||
    /\bwithout\b[^.?!\n]*(?:bump(?:ing)?(?:\s+the)?\s+version|version\s+bump|cut(?:ting)?(?:\s+a)?\s+version)\b/i.test(
      intent,
    )
  );
}

export function prohibitedWorkflowKeywordMatches(
  entry: RouteToolEntry,
  _keyword: string,
  hasProhibitedReleaseAction: boolean,
  hasProhibitedVersionBump: boolean,
): boolean {
  return (
    (entry.tool === 'projscan_release_train' && hasProhibitedReleaseAction) ||
    (entry.tool === 'projscan_upgrade' && hasProhibitedVersionBump)
  );
}

function releaseReadinessContextMatches(tokens: Set<string>): boolean {
  return [
    'release',
    'releasing',
    'deploy',
    'deploying',
    'deployed',
    'deployment',
    'ship',
    'shipping',
    'publish',
    'tag',
    'changelog',
    'sbom',
    'package',
  ].some((token) => tokens.has(token));
}

export function releaseTrainKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (keyword === 'check') return releaseReadinessContextMatches(tokens);
  if (['changed', 'since', 'last'].includes(keyword)) {
    return (
      releaseCommunicationContextMatches(tokens) &&
      (tokens.has('changed') || tokens.has('change') || tokens.has('changes'))
    );
  }
  if (
    ['note', 'notes', 'draft', 'entry', 'summarize', 'summary', 'change', 'changes'].includes(
      keyword,
    )
  ) {
    return releaseCommunicationContextMatches(tokens);
  }
  return true;
}

function releaseCommunicationContextMatches(tokens: Set<string>): boolean {
  return [
    'release',
    'releasing',
    'deploy',
    'deploying',
    'deployed',
    'deployment',
    'ship',
    'shipping',
    'publish',
    'tag',
    'changelog',
  ].some((token) => tokens.has(token));
}
