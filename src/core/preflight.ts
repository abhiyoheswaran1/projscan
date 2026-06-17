import { pluginsEnabled } from './plugins.js';
import { policyIssueReasons } from './preflightIssueReasons.js';
import { changedFileReasons } from './preflightChangedFileReasons.js';
import { buildRequiredChecks } from './preflightRequiredChecks.js';
import { buildReleaseScaleEvidence } from './preflightReleaseScale.js';
import { reviewReasons } from './preflightReviewReasons.js';
import { buildEvidence } from './preflightEvidence.js';
import { contextReasons } from './preflightContextReasons.js';
import {
  buildSuggestedActions,
  buildToolCalls,
} from './preflightSuggestedActions.js';
import {
  decidePreflightVerdict,
  summarizePreflight,
} from './preflightVerdict.js';
import type { PreflightReviewEvidence } from './preflightReviewEvidence.js';
import type { PreflightChangedFiles } from './preflightChangedFiles.js';
import {
  type CoordinationSummary,
  type PreflightSessionEvidence,
} from './preflightLocalEvidence.js';
import { loadPreflightInputs } from './preflightInputs.js';
import { isPreflightReportTruncated } from './preflightTruncation.js';
import type {
  HealthScore,
  HotspotReport,
  Issue,
  PreflightMode,
  PreflightReason,
  PreflightReleaseScaleEvidence,
  PreflightReport,
} from '../types.js';

export { decidePreflightVerdict, summarizePreflight };

export interface ComputePreflightOptions {
  mode?: PreflightMode;
  baseRef?: string;
  headRef?: string;
  maxChangedFiles?: number;
  enablePlugins?: boolean;
}

const DEFAULT_MAX_CHANGED_FILES = 50;

export async function computePreflight(
  rootPath: string,
  options: ComputePreflightOptions = {},
): Promise<PreflightReport> {
  const mode = options.mode ?? 'before_edit';
  const { issues, health, changedFiles, session, hotspots, review, coordination } =
    await loadPreflightInputs(rootPath, mode, options);
  const maxChangedFiles = options.maxChangedFiles ?? DEFAULT_MAX_CHANGED_FILES;
  const supplyChain = countSupplyChainIssues(issues);
  const releaseScale = buildReleaseScaleEvidence({
    mode,
    issues,
    changedFiles,
    health,
    review,
    supplyChain,
    maxChangedFiles,
  });
  const reasons = buildPreflightReasons({
    mode,
    issues,
    changedFiles,
    health,
    session,
    hotspots,
    review,
    releaseScale,
    coordination,
    maxChangedFiles,
  });
  const verdict = decidePreflightVerdict(reasons);
  const evidence = buildEvidence({
    health,
    changedFiles,
    session,
    hotspots,
    issues,
    pluginsEnabledForRun: pluginsEnabled(),
    review,
    releaseScale,
    coordination,
  });
  const truncated = isPreflightReportTruncated({ evidence, changedFiles });
  const report: PreflightReport = {
    schemaVersion: 1,
    mode,
    verdict,
    summary: '',
    reasons,
    evidence,
    requiredChecks: buildRequiredChecks({
      mode,
      health,
      changedFiles,
      review,
      supplyChain,
      releaseScale,
    }),
    suggestedNextActions: buildSuggestedActions({ reasons, mode, changedFiles }),
    toolCalls: buildToolCalls({ reasons, mode, changedFiles }),
    ...(truncated ? { truncated: true } : {}),
  };
  return { ...report, summary: summarizePreflight(report) };
}

function countSupplyChainIssues(issues: Issue[]): { errorIssues: number; warningIssues: number } {
  const supplyChainIssues = issues.filter((issue) => issue.category === 'supply-chain');
  return {
    errorIssues: supplyChainIssues.filter((issue) => issue.severity === 'error').length,
    warningIssues: supplyChainIssues.filter((issue) => issue.severity === 'warning').length,
  };
}

function buildPreflightReasons(input: {
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
