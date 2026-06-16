import type { ReviewReport, ReviewTier } from '../types/review.js';

/**
 * 1.5+ - pick a review tier based on the caller's token budget.
 *
 *   <3000  -> 'verdict-only'  (verdict + summary + totals)
 *   <7000  -> 'summary'       (verdict + summary + top files / top cycles / etc.)
 *   else   -> 'full'          (everything)
 *
 * `0`, `undefined`, and any non-positive value all mean "no budget given"
 * - the caller wants the full report. The tier names are stable.
 */
export function selectReviewTier(maxCostTokens: number | undefined): ReviewTier {
  if (maxCostTokens === undefined) return 'full';
  if (hasInvalidReviewBudget(maxCostTokens)) return 'full';
  if (maxCostTokens < 3000) return 'verdict-only';
  if (maxCostTokens < 7000) return 'summary';
  return 'full';
}

function hasInvalidReviewBudget(maxCostTokens: number): boolean {
  return !Number.isFinite(maxCostTokens) || maxCostTokens <= 0;
}

/**
 * Reshape a full ReviewReport for the chosen tier. The caller passes a
 * fully populated report from `computeReview`; this returns a plain object
 * sized for the tier.
 */
export function shapeReviewForTier(
  report: ReviewReport,
  tier: ReviewTier,
): Record<string, unknown> {
  if (!report.available || tier === 'full') {
    return { ...report, tier };
  }

  const totals = reviewTierTotals(report);
  if (tier === 'verdict-only') {
    return verdictOnlyReview(report, totals, tier);
  }
  return summaryReview(report, totals, tier);
}

function reviewTierTotals(report: ReviewReport): Record<string, number> {
  return {
    filesChanged: report.changedFiles.length,
    cyclesAdded: report.newCycles.length,
    riskyFunctionsAdded: report.riskyFunctions.length,
    depsChanged: report.dependencyChanges.length,
    taintFlowsAdded: report.newTaintFlows?.length ?? 0,
    dataflowRisksAdded: report.newDataflowRisks?.length ?? 0,
    contractChanges: report.contractChanges?.length ?? 0,
  };
}

function verdictOnlyReview(
  report: ReviewReport,
  totals: Record<string, number>,
  tier: ReviewTier,
): Record<string, unknown> {
  return {
    available: report.available,
    base: report.base,
    head: report.head,
    verdict: report.verdict,
    summary: report.summary,
    totals,
    graphEvidence: report.graphEvidence,
    tier,
  };
}

function summaryReview(
  report: ReviewReport,
  totals: Record<string, number>,
  tier: ReviewTier,
): Record<string, unknown> {
  const top = 5;
  return {
    available: report.available,
    base: report.base,
    head: report.head,
    prDiff: trimmedPrDiff(report, top),
    changedFiles: report.changedFiles.slice(0, top),
    newCycles: report.newCycles.slice(0, 3),
    riskyFunctions: report.riskyFunctions.slice(0, 3),
    dependencyChanges: report.dependencyChanges.slice(0, 3),
    contractChanges: report.contractChanges?.slice(0, top) ?? [],
    newTaintFlows: report.newTaintFlows?.slice(0, 5) ?? [],
    newDataflowRisks: report.newDataflowRisks?.slice(0, 5) ?? [],
    graphEvidence: report.graphEvidence,
    verdict: report.verdict,
    summary: report.summary,
    totals,
    tier,
  };
}

function trimmedPrDiff(report: ReviewReport, top: number): Record<string, unknown> {
  return {
    available: report.prDiff.available,
    base: report.prDiff.base,
    head: report.prDiff.head,
    totalFilesChanged: report.prDiff.totalFilesChanged,
    filesAdded: report.prDiff.filesAdded.slice(0, top),
    filesRemoved: report.prDiff.filesRemoved.slice(0, top),
    filesModified: report.prDiff.filesModified.slice(0, top).map((file) => ({
      relativePath: file.relativePath,
      cyclomaticDelta: file.cyclomaticDelta,
      fanInDelta: file.fanInDelta,
    })),
  };
}
