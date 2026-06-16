import type { ReviewReport } from '../types/review.js';

interface NoChangeReviewInput {
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
}

export function buildNoChangeReviewReport(input: NoChangeReviewInput): ReviewReport {
  return {
    available: true,
    base: { ref: input.baseRef, resolvedSha: input.baseSha },
    head: { ref: input.headRef, resolvedSha: input.headSha },
    prDiff: {
      available: true,
      base: { ref: input.baseRef, resolvedSha: input.baseSha },
      head: { ref: input.headRef, resolvedSha: input.headSha },
      filesAdded: [],
      filesRemoved: [],
      filesModified: [],
      totalFilesChanged: 0,
    },
    changedFiles: [],
    newCycles: [],
    riskyFunctions: [],
    dependencyChanges: [],
    contractChanges: [],
    newTaintFlows: [],
    newDataflowRisks: [],
    verdict: 'ok',
    summary: ['No structural changes detected between base and head.'],
  };
}
