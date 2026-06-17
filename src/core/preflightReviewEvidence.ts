import { computeReview } from './review.js';
import type { PreflightMode } from '../types.js';
import type { ReviewReport } from '../types/review.js';

interface PreflightReviewOptions {
  baseRef?: string;
  headRef?: string;
}

export interface PreflightReviewEvidence {
  available: boolean;
  verdict?: ReviewReport['verdict'];
  summary?: string;
  reason?: string;
  newTaintFlows?: number;
  newDataflowRisks?: number;
}

export async function safeReviewEvidence(
  rootPath: string,
  mode: PreflightMode,
  options: PreflightReviewOptions,
): Promise<PreflightReviewEvidence> {
  if (mode === 'before_edit') {
    return { available: false, reason: 'review is not required before edits' };
  }
  try {
    return reviewEvidenceFromReport(
      await computeReview(rootPath, {
        base: options.baseRef,
        head: options.headRef,
      }),
    );
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

function reviewEvidenceFromReport(report: ReviewReport): PreflightReviewEvidence {
  if (!report.available) {
    return { available: false, reason: report.reason };
  }
  return {
    available: true,
    verdict: report.verdict,
    summary: report.summary.join('; '),
    newTaintFlows: report.newTaintFlows.length,
    newDataflowRisks: report.newDataflowRisks.length,
  };
}
