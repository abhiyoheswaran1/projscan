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
  reasons.push(...changedFileReasons(input));
  if (input.releaseScale?.detected) {
    reasons.push({
      severity: 'warning',
      source: 'release',
      message: input.releaseScale.explanation,
      tool: 'projscan_review',
    });
  }

  reasons.push(...reviewReasons(input));
  reasons.push(...contextReasons(input));
  return reasons;
}
