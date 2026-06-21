const REVIEWER_ROUTING_KEYWORDS = ['who', 'owner', 'owners', 'routing', 'reviewer', 'reviewers'];
const PR_REVIEW_KEYWORDS = [
  'pr',
  'pull',
  'request',
  'review',
  'reviewer',
  'reviewers',
  'comment',
];
const PR_NARRATIVE_KEYWORDS = ['pr', 'pull', 'request'];
const TEAM_NARRATIVE_ACTION_KEYWORDS = ['tell', 'share', 'team'];
const TEAM_NARRATIVE_SUBJECT_KEYWORDS = ['change', 'changes', 'changed', 'pr', 'pull', 'request'];
const PR_READINESS_KEYWORDS = ['ready', 'open', 'opening', 'before', 'prepare'];
const PR_READINESS_ACTION_KEYWORDS = ['ready', 'open', 'opening', 'prepare'];
const CHANGED_FILE_OWNER_KEYWORDS = ['who', 'owner', 'owners', 'owns'];
const OWNER_REVIEW_CONTEXT_KEYWORDS = [
  'review',
  'reviewer',
  'reviewers',
  'pr',
  'pull',
  'request',
  'comment',
];

interface EvidencePackContexts {
  readonly reviewerRouting: boolean;
  readonly prReview: boolean;
  readonly prNarrative: boolean;
  readonly reviewerSummary: boolean;
  readonly teamNarrative: boolean;
  readonly versionCandidateReview: boolean;
  readonly noPublishReleaseReadiness: boolean;
  readonly prReadiness: boolean;
  readonly changedFileOwner: boolean;
}

export function evidencePackKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const contexts = evidencePackContexts(tokens);
  const matcher = evidencePackKeywordMatchers(contexts, tokens).find((entry) =>
    entry.keywords.includes(keyword),
  );
  return matcher ? matcher.matches() : true;
}

export function reviewKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const reviewContext = hasAnyToken(tokens, [
    'review',
    'pr',
    'pull',
    'request',
    'branch',
    'diff',
    'change',
    'changes',
  ]);
  if (['risk', 'risks', 'risky', 'branch'].includes(keyword)) return reviewContext;
  if (['secure', 'security'].includes(keyword)) return reviewContext || tokens.has('check');
  if (['issues', 'check'].includes(keyword)) return tokens.has('security') && reviewContext;
  if (keyword === 'change')
    return tokens.has('secure') || tokens.has('security') || tokens.has('review');
  return true;
}

export function structuralReviewWorkflowContextMatches(tokens: Set<string>): boolean {
  if (!tokens.has('review')) return false;
  if (hasAnyToken(tokens, ['search', 'find', 'locate', 'where', 'show'])) return false;
  return hasAnyToken(tokens, ['agent', 'ai', 'generated', 'commit', 'verification', 'debt']);
}

function evidencePackContexts(tokens: Set<string>): EvidencePackContexts {
  const prReview = hasAnyToken(tokens, PR_REVIEW_KEYWORDS);
  const reviewerSummary =
    (tokens.has('summarize') || tokens.has('summary')) &&
    tokens.has('changes') &&
    hasAnyToken(tokens, ['reviewer', 'reviewers', 'pr', 'pull', 'request']);
  const teamNarrative =
    hasAnyToken(tokens, TEAM_NARRATIVE_ACTION_KEYWORDS) &&
    hasAnyToken(tokens, TEAM_NARRATIVE_SUBJECT_KEYWORDS);
  const versionCandidateReview =
    tokens.has('review') && (tokens.has('version') || tokens.has('candidate'));
  const noPublishReleaseReadiness =
    tokens.has('release') &&
    hasAnyToken(tokens, ['ready', 'readiness', 'check']) &&
    hasAnyToken(tokens, ['publish', 'publishing']) &&
    hasAnyToken(tokens, ['without', 'not', 'never']);
  return {
    reviewerRouting: hasAnyToken(tokens, REVIEWER_ROUTING_KEYWORDS),
    prReview,
    prNarrative: hasAnyToken(tokens, PR_NARRATIVE_KEYWORDS),
    reviewerSummary,
    teamNarrative,
    versionCandidateReview,
    noPublishReleaseReadiness,
    prReadiness:
      versionCandidateReview ||
      noPublishReleaseReadiness ||
      (hasAnyToken(tokens, PR_NARRATIVE_KEYWORDS) &&
        hasAnyToken(tokens, PR_READINESS_ACTION_KEYWORDS)),
    changedFileOwner:
      tokens.has('changed') &&
      (tokens.has('file') || tokens.has('files')) &&
      hasAnyToken(tokens, CHANGED_FILE_OWNER_KEYWORDS),
  };
}

function evidencePackKeywordMatchers(contexts: EvidencePackContexts, tokens: Set<string>) {
  return [
    {
      keywords: ['description', 'draft', 'say', 'checklist'],
      matches: () => contexts.prNarrative,
    },
    {
      keywords: ['tell', 'team', 'share', 'change'],
      matches: () => contexts.teamNarrative,
    },
    {
      keywords: ['summarize', 'changes'],
      matches: () => contexts.reviewerSummary || contexts.teamNarrative,
    },
    {
      keywords: ['summary'],
      matches: () => contexts.prReview || contexts.reviewerSummary,
    },
    {
      keywords: ['review'],
      matches: () => contexts.reviewerRouting || contexts.prReadiness,
    },
    {
      keywords: PR_READINESS_KEYWORDS,
      matches: () => contexts.prReadiness,
    },
    {
      keywords: ['release', 'readiness', 'check', 'publish', 'publishing'],
      matches: () => contexts.noPublishReleaseReadiness,
    },
    {
      keywords: ['changed', 'file', 'files'],
      matches: () => contexts.changedFileOwner,
    },
    {
      keywords: ['who', 'owner', 'owners', 'owns', 'routing'],
      matches: () =>
        contexts.changedFileOwner || hasAnyToken(tokens, OWNER_REVIEW_CONTEXT_KEYWORDS),
    },
  ];
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
