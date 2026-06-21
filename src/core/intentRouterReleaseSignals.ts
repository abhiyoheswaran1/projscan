type RouteToolEntry = {
  tool: string;
};

type KeywordRule = {
  keywords: Set<string>;
  matches: (tokens: Set<string>) => boolean;
};

const RELEASE_READINESS_CONTEXT_TOKENS = [
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
];
const RELEASE_COMMUNICATION_CONTEXT_TOKENS = [
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
];
const RELEASE_CHANGE_KEYWORDS = new Set(['build', 'built', 'changed', 'since', 'last']);
const RELEASE_CHANGE_CONTEXT_TOKENS = ['build', 'built', 'changed', 'change', 'changes'];
const RELEASE_PLANNING_KEYWORDS = new Set([
  'plan',
  'roadmap',
  'next',
  'product',
  'products',
  'feature',
  'features',
  'workstream',
  'workstreams',
]);
const RELEASE_NOTE_KEYWORDS = new Set([
  'note',
  'notes',
  'draft',
  'entry',
  'summarize',
  'summary',
  'change',
  'changes',
]);
const RELEASE_VERSION_CANDIDATE_KEYWORDS = new Set([
  'cut',
  'cutting',
  'version',
  'versions',
  'candidate',
  'worth',
]);
const RELEASE_VERSION_TOKENS = ['version', 'versions'];
const RELEASE_VERSION_ACTION_TOKENS = ['cut', 'cutting', 'candidate', 'worth'];

const RELEASE_TRAIN_KEYWORD_RULES: KeywordRule[] = [
  {
    keywords: new Set(['check']),
    matches: releaseReadinessContextMatches,
  },
  {
    keywords: RELEASE_CHANGE_KEYWORDS,
    matches: (tokens) =>
      (releaseCommunicationContextMatches(tokens) &&
        hasAnyToken(tokens, RELEASE_CHANGE_CONTEXT_TOKENS)) ||
      releasePlanningContextMatches(tokens),
  },
  {
    keywords: RELEASE_PLANNING_KEYWORDS,
    matches: releasePlanningContextMatches,
  },
  {
    keywords: RELEASE_NOTE_KEYWORDS,
    matches: releaseCommunicationContextMatches,
  },
  {
    keywords: RELEASE_VERSION_CANDIDATE_KEYWORDS,
    matches: releaseVersionCandidateContextMatches,
  },
];

export function hasProhibitedReleaseWorkflowAction(intent: string): boolean {
  return (
    /\bno(?:[-\s]+more)?[-\s]+(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping)\b/i.test(
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
    /\bno(?:[-\s]+more)?[-\s]+(?:version[-\s]+)?(?:bump|cut)\b/i.test(intent) ||
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
    (entry.tool === 'projscan_release_train' &&
      (hasProhibitedReleaseAction || hasProhibitedVersionBump)) ||
    (entry.tool === 'projscan_upgrade' && hasProhibitedVersionBump)
  );
}

function releaseReadinessContextMatches(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, RELEASE_READINESS_CONTEXT_TOKENS);
}

export function releaseTrainKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (releaseChangeSummaryLookupContextMatches(tokens)) return false;
  const rule = RELEASE_TRAIN_KEYWORD_RULES.find((candidate) => candidate.keywords.has(keyword));
  return rule ? rule.matches(tokens) : true;
}

export function releaseChangeSummaryLookupContextMatches(tokens: Set<string>): boolean {
  const sinceLastRelease = tokens.has('since') && tokens.has('last') && tokens.has('release');
  const changeSummarySubject = hasAnyToken(tokens, [
    'build',
    'built',
    'change',
    'changed',
    'changes',
    'commit',
    'commits',
    'implement',
    'implemented',
  ]);
  const changedSinceLastRelease =
    sinceLastRelease &&
    (changeSummarySubject ||
      (tokens.has('summary') && (tokens.has('work') || tokens.has('change'))));
  const currentChangelogEntry =
    tokens.has('changelog') &&
    tokens.has('entry') &&
    (tokens.has('current') || tokens.has('work'));
  if (!changedSinceLastRelease && !currentChangelogEntry) return false;
  return !hasAnyToken(tokens, [
    'approval',
    'approve',
    'candidate',
    'cut',
    'cutting',
    'deploy',
    'deploying',
    'deployment',
    'prepare',
    'preparing',
    'publish',
    'publishing',
    'readiness',
    'ready',
    'ship',
    'shipping',
    'tag',
    'tagging',
    'version',
    'versions',
    'worth',
  ]);
}

function releaseCommunicationContextMatches(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, RELEASE_COMMUNICATION_CONTEXT_TOKENS);
}

function releasePlanningContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, ['roadmap', 'workstream', 'workstreams'])) return true;
  return tokens.has('plan') && hasAnyToken(tokens, ['product', 'products', 'feature', 'features']);
}

function releaseVersionCandidateContextMatches(tokens: Set<string>): boolean {
  return (
    releaseCommunicationContextMatches(tokens) ||
    (hasAnyToken(tokens, RELEASE_VERSION_TOKENS) &&
      hasAnyToken(tokens, RELEASE_VERSION_ACTION_TOKENS))
  );
}

function hasAnyToken(tokens: Set<string>, candidates: readonly string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
