import { changedFileReasons } from './preflightChangedFileReasons.js';
import { contextReasons } from './preflightContextReasons.js';
import { policyIssueReasons } from './preflightIssueReasons.js';
import {
  type CoordinationSummary,
  type PreflightSessionEvidence,
} from './preflightLocalEvidence.js';
import type { PreflightChangedFiles } from './preflightChangedFiles.js';
import type { PreflightReviewEvidence } from './preflightReviewEvidence.js';
import { reviewReasons } from './preflightReviewReasons.js';
import type {
  HealthScore,
  HotspotReport,
  Issue,
  PreflightMode,
  PreflightReason,
  PreflightReleaseScaleEvidence,
} from '../types.js';

export interface PreflightSupplyChainIssueCounts {
  errorIssues: number;
  warningIssues: number;
}

export function countSupplyChainIssues(issues: Issue[]): PreflightSupplyChainIssueCounts {
  const supplyChainIssues = issues.filter((issue) => issue.category === 'supply-chain');
  return {
    errorIssues: supplyChainIssues.filter((issue) => issue.severity === 'error').length,
    warningIssues: supplyChainIssues.filter((issue) => issue.severity === 'warning').length,
  };
}

export function buildPreflightReasons(input: {
  mode: PreflightMode;
  issues: Issue[];
  changedFiles: PreflightChangedFiles;
  health: HealthScore;
  session: PreflightSessionEvidence;
  hotspots: HotspotReport | null;
  review: PreflightReviewEvidence;
  releaseScale: PreflightReleaseScaleEvidence | null;
  coordination: CoordinationSummary | null;
  maxChangedFiles: number;
}): PreflightReason[] {
  const reasons: PreflightReason[] = [];
  reasons.push(...policyIssueReasons(input.issues));
  reasons.push(...nonDuplicateChangedFileReasons(changedFileReasons(input), input.releaseScale));
  reasons.push(...releaseReasons(input.releaseScale));
  reasons.push(...nonDuplicateReviewReasons(reviewReasons(input), input.releaseScale));
  reasons.push(...contextReasons(input));
  return reasons;
}

function releaseReasons(
  releaseScale: PreflightReleaseScaleEvidence | null,
): PreflightReason[] {
  if (!releaseScale?.detected) return [];
  return [
    {
      severity: 'warning',
      source: 'release',
      message: releaseScale.explanation,
      tool: 'projscan_review',
    },
  ];
}

function nonDuplicateChangedFileReasons(
  reasons: PreflightReason[],
  releaseScale: PreflightReleaseScaleEvidence | null,
): PreflightReason[] {
  if (!releaseScale?.detected) return reasons;
  return reasons.filter((reason) => reason.source !== 'changed-files');
}

function nonDuplicateReviewReasons(
  reasons: PreflightReason[],
  releaseScale: PreflightReleaseScaleEvidence | null,
): PreflightReason[] {
  if (!releaseScale?.detected) return reasons;
  return reasons.filter((reason) => !isReleaseScaleReviewDuplicate(reason, releaseScale));
}

function isReleaseScaleReviewDuplicate(
  reason: PreflightReason,
  releaseScale: PreflightReleaseScaleEvidence,
): boolean {
  return (
    reason.source === 'review' &&
    isScaleOnlyReviewSummary(releaseScale.reviewSummary) &&
    reason.message.startsWith('Review verdict is block due to scale/complexity risk:') &&
    reason.message.includes('Maximum changed-file risk score')
  );
}

function isScaleOnlyReviewSummary(summary: string | undefined): boolean {
  if (!summary?.includes('Maximum changed-file risk score')) return false;
  return !summary.includes('new import cycle');
}
