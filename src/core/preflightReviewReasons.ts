import type {
  PreflightMode,
  PreflightReason,
  PreflightReleaseScaleEvidence,
} from '../types.js';
import type { ReviewReport } from '../types/review.js';

interface ReviewEvidence {
  available: boolean;
  verdict?: ReviewReport['verdict'];
  summary?: string;
  reason?: string;
  newTaintFlows?: number;
}

export function reviewReasons(input: {
  mode: PreflightMode;
  review: ReviewEvidence;
  releaseScale: PreflightReleaseScaleEvidence | null;
}): PreflightReason[] {
  const reasons: PreflightReason[] = [];
  const taint = taintReason(input.review);
  const verdict = reviewVerdictReason(input.review, input.releaseScale);
  const unavailable = reviewUnavailableReason(input.mode, input.review);

  if (taint) reasons.push(taint);
  if (verdict) reasons.push(verdict);
  if (unavailable) reasons.push(unavailable);
  return reasons;
}

function taintReason(review: ReviewEvidence): PreflightReason | undefined {
  const newTaintFlows = review.newTaintFlows ?? 0;
  if (!review.available || newTaintFlows <= 0) return undefined;
  return {
    severity: 'error',
    source: 'taint',
    message: `${newTaintFlows} new taint flow(s) found in review`,
    tool: 'projscan_review',
  };
}

function reviewVerdictReason(
  review: ReviewEvidence,
  releaseScale: PreflightReleaseScaleEvidence | null,
): PreflightReason | undefined {
  if (!review.available) return undefined;
  if (review.verdict === 'block') {
    return reviewBlockReason(review, releaseScale);
  }
  return reviewCautionReason(review);
}

function reviewBlockReason(
  review: ReviewEvidence,
  releaseScale: PreflightReleaseScaleEvidence | null,
): PreflightReason {
  return {
    severity: releaseScale?.detected ? 'warning' : 'error',
    source: 'review',
    message: formatReviewBlockMessage(review, releaseScale),
    tool: 'projscan_review',
  };
}

function reviewCautionReason(review: ReviewEvidence): PreflightReason | undefined {
  if (review.verdict === 'review') {
    return {
      severity: 'warning',
      source: 'review',
      message: 'Review verdict requires careful review',
      tool: 'projscan_review',
    };
  }
  return undefined;
}

function reviewUnavailableReason(
  mode: PreflightMode,
  review: ReviewEvidence,
): PreflightReason | undefined {
  if (!shouldReportReviewUnavailable(mode, review)) return undefined;
  return reviewUnavailableWarning(review.reason);
}

function shouldReportReviewUnavailable(mode: PreflightMode, review: ReviewEvidence): boolean {
  if (mode === 'before_edit') return false;
  return !review.available;
}

function reviewUnavailableWarning(reason?: string): PreflightReason {
  return {
    severity: 'warning',
    source: 'review',
    message: `Review unavailable: ${reason ?? 'unknown reason'}`,
    tool: 'projscan_review',
  };
}

function formatReviewBlockMessage(
  review: ReviewEvidence,
  releaseScale: PreflightReleaseScaleEvidence | null,
): string {
  if (releaseScale?.detected) {
    return `Review verdict is block due to scale/complexity risk: ${review.summary ?? 'review requires manual sign-off'}`;
  }
  return 'Review verdict is block';
}
