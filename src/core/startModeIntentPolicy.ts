type PreflightStartMode = 'before_edit' | 'before_commit' | 'before_merge';
type ReviewStartMode = 'before_commit' | 'before_merge';

export function preflightModeFromIntent(intent: string): PreflightStartMode {
  const text = intent.toLowerCase();
  if (
    !hasProhibitedWorkflowModeAction(intent) &&
    /\b(?:merge|merged|merging|release|rebase|rebasing|conflict|conflicts|resolve|resolving)\b/.test(
      text,
    )
  )
    return 'before_merge';
  if (
    /\b(?:commit|committing|committed|pr|pull\s+request)\b/.test(text) ||
    handoffIntentMatches(text)
  )
    return 'before_commit';
  return 'before_edit';
}

export function hasPreflightModeHint(intent: string): boolean {
  return (
    /\b(?:safe|safety|gate|preflight|commit|committing|committed|merge|merged|merging|rebase|rebasing|conflict|conflicts|resolve|resolving|edit|proceed|block|blocked|blocker|blockers|blocking|allowed)\b/i.test(
      intent,
    ) || handoffIntentMatches(intent)
  );
}

export function hasContinuationPlanningHint(intent: string): boolean {
  return /\b(?:keep\s+going|keep\s+(?:improving|working|implementing)|continue|continuing|go\s+on|improve|improving|implement|implementing|implementation|roadmap|user\s+research)\b/i.test(
    intent,
  );
}

export function handoffIntentMatches(intent: string): boolean {
  return /\b(?:handoff|handover|hand\s+off)\b/i.test(intent);
}

export function releaseCandidateReviewIntentMatches(intent: string): boolean {
  return (
    /\brelease[-\s]+candidate\b/i.test(intent) &&
    /\b(?:review|approval|readiness|evidence|prepare|prepared|preparing)\b/i.test(intent)
  );
}

export function noPublishReleaseReadinessIntentMatches(intent: string): boolean {
  return (
    /\brelease\b/i.test(intent) &&
    /\b(?:ready|readiness|check|proof|review)\b/i.test(intent) &&
    (/\bwithout\b[^.?!\n]*(?:publish|publishing)\b/i.test(intent) ||
      /\b(?:do\s+not|don't|dont|never)\b[^.?!\n]*(?:publish|publishing)\b/i.test(intent))
  );
}

export function hasProhibitedWorkflowModeAction(intent: string): boolean {
  return (
    /\bno(?:[-\s]+more)?[-\s]+(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping|version[-\s]+bump|bump)\b/i.test(
      intent,
    ) ||
    /\b(?:do\s+not|don't|dont|never)\b[^.?!\n]*(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping|bump(?:ing)?(?:\s+the)?\s+version|version\s+bump)\b/i.test(
      intent,
    ) ||
    /\bwithout\b[^.?!\n]*(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping|bump(?:ing)?(?:\s+the)?\s+version|version\s+bump)\b/i.test(
      intent,
    )
  );
}

export function regressionModeFromIntent(intent: string): ReviewStartMode {
  return /\bmerge|merged|merging|release\b/i.test(intent) ? 'before_merge' : 'before_commit';
}

export function reviewModeFromIntent(intent: string): ReviewStartMode {
  return /\bmerge|merged|merging\b/i.test(intent) ? 'before_merge' : 'before_commit';
}
