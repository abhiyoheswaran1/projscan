import type {
  HealthScore,
  PreflightMode,
  PreflightReleaseScaleEvidence,
  PreflightRequiredCheck,
} from '../types.js';
import type { ReviewReport } from '../types/review.js';

interface ChangedFilesEvidence {
  available: boolean;
  count: number;
  reason?: string;
}

interface ReviewEvidence {
  available: boolean;
  verdict?: ReviewReport['verdict'];
  summary?: string;
  reason?: string;
}

interface PolicyIssueCounts {
  errorIssues: number;
  warningIssues: number;
}

export function buildRequiredChecks(input: {
  mode: PreflightMode;
  health: HealthScore;
  changedFiles: ChangedFilesEvidence;
  review: ReviewEvidence;
  supplyChain?: PolicyIssueCounts;
  releaseScale?: PreflightReleaseScaleEvidence | null;
}): PreflightRequiredCheck[] {
  return [
    healthRequiredCheck(input.health),
    supplyChainRequiredCheck(input.supplyChain),
    changedFilesRequiredCheck(input.changedFiles),
    reviewRequiredCheck(input.mode, input.review, input.releaseScale),
  ];
}

function healthRequiredCheck(health: HealthScore): PreflightRequiredCheck {
  return {
    name: 'health',
    status: healthCheckStatus(health),
    reason: `${health.errors} error(s), ${health.warnings} warning(s), ${health.infos} info`,
  };
}

function healthCheckStatus(health: HealthScore): PreflightRequiredCheck['status'] {
  if (health.errors > 0) return 'fail';
  if (health.warnings > 0) return 'warn';
  return 'pass';
}

function supplyChainRequiredCheck(
  supplyChain?: PolicyIssueCounts,
): PreflightRequiredCheck {
  const { errorIssues, warningIssues } = normalizedPolicyIssueCounts(supplyChain);
  return {
    name: 'supply-chain',
    status: policyCheckStatus(errorIssues, warningIssues),
    reason: `${errorIssues} error(s), ${warningIssues} warning(s)`,
  };
}

function normalizedPolicyIssueCounts(supplyChain?: PolicyIssueCounts): PolicyIssueCounts {
  return {
    errorIssues: supplyChain?.errorIssues ?? 0,
    warningIssues: supplyChain?.warningIssues ?? 0,
  };
}

function policyCheckStatus(
  errorIssues: number,
  warningIssues: number,
): PreflightRequiredCheck['status'] {
  if (errorIssues > 0) return 'fail';
  if (warningIssues > 0) return 'warn';
  return 'pass';
}

function changedFilesRequiredCheck(
  changedFiles: ChangedFilesEvidence,
): PreflightRequiredCheck {
  return {
    name: 'changed-files',
    status: changedFiles.available ? 'pass' : 'unavailable',
    reason: changedFiles.available
      ? `${changedFiles.count} changed file(s)`
      : (changedFiles.reason ?? 'changed-file detection unavailable'),
  };
}

function reviewRequiredCheck(
  mode: PreflightMode,
  review: ReviewEvidence,
  releaseScale?: PreflightReleaseScaleEvidence | null,
): PreflightRequiredCheck {
  return {
    name: 'review',
    status: reviewCheckStatus(mode, review, releaseScale),
    reason: reviewCheckReason(mode, review, releaseScale),
  };
}

function reviewCheckStatus(
  mode: PreflightMode,
  review: ReviewEvidence,
  releaseScale?: PreflightReleaseScaleEvidence | null,
): PreflightRequiredCheck['status'] {
  if (mode === 'before_edit') return 'unavailable';
  if (!review.available) return 'unavailable';
  if (review.verdict === 'block') return reviewBlockStatus(releaseScale);
  if (review.verdict === 'review') return 'warn';
  return 'pass';
}

function reviewBlockStatus(
  releaseScale?: PreflightReleaseScaleEvidence | null,
): PreflightRequiredCheck['status'] {
  return releaseScale?.detected ? 'warn' : 'fail';
}

function reviewCheckReason(
  mode: PreflightMode,
  review: ReviewEvidence,
  releaseScale?: PreflightReleaseScaleEvidence | null,
): string {
  if (mode === 'before_edit') return 'review is not required before edits';
  if (!review.available) return review.reason ?? 'review unavailable';
  return formatReviewCheckReason(review, releaseScale);
}

function formatReviewCheckReason(
  review: ReviewEvidence,
  releaseScale?: PreflightReleaseScaleEvidence | null,
): string {
  if (usesReleaseScaleReason(review, releaseScale)) {
    return `scale/complexity: ${reviewCheckFallback(review)}`;
  }
  return reviewCheckFallback(review);
}

function usesReleaseScaleReason(
  review: ReviewEvidence,
  releaseScale?: PreflightReleaseScaleEvidence | null,
): boolean {
  return review.verdict === 'block' && releaseScaleDetected(releaseScale);
}

function releaseScaleDetected(releaseScale?: PreflightReleaseScaleEvidence | null): boolean {
  return releaseScale?.detected === true;
}

function reviewCheckFallback(review: ReviewEvidence): string {
  return review.summary ?? review.verdict ?? 'review unavailable';
}
