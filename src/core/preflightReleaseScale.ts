import type {
  HealthScore,
  Issue,
  PreflightMode,
  PreflightReleaseScaleEvidence,
} from '../types.js';
import type { ReviewReport } from '../types/review.js';

interface ChangedFilesEvidence {
  available: boolean;
  count: number;
}

interface ReviewEvidence {
  available: boolean;
  verdict?: ReviewReport['verdict'];
  summary?: string;
  newTaintFlows?: number;
  newDataflowRisks?: number;
}

interface SupplyChainIssueCounts {
  errorIssues: number;
  warningIssues: number;
}

interface ReleaseScaleInput {
  mode: PreflightMode;
  issues: Issue[];
  changedFiles: ChangedFilesEvidence;
  health: HealthScore;
  review: ReviewEvidence;
  supplyChain: SupplyChainIssueCounts;
  maxChangedFiles: number;
}

interface ReleaseScaleSignals {
  detected: boolean;
  changedFileThresholdExceeded: boolean;
  reviewScaleOnly: boolean;
  reviewBlocksOnScale: boolean;
  reviewSummary?: string;
  triggers: string[];
}

interface ReleaseScaleState {
  concreteBlockers: string[];
  signals: ReleaseScaleSignals;
}

export function buildReleaseScaleEvidence(
  input: ReleaseScaleInput,
): PreflightReleaseScaleEvidence | null {
  const state = releaseScaleState(input);
  if (!state) return null;

  return releaseScaleEvidence(input, state);
}

function releaseScaleState(input: ReleaseScaleInput): ReleaseScaleState | null {
  if (!canEvaluateReleaseScale(input)) return null;

  const concreteBlockers = concretePreflightBlockers(input);
  if (concreteBlockers.length > 0) return null;

  const signals = releaseScaleSignals(input);
  if (!signals.detected) return null;

  return { concreteBlockers, signals };
}

function releaseScaleEvidence(
  input: ReleaseScaleInput,
  state: ReleaseScaleState,
): PreflightReleaseScaleEvidence {
  return {
    detected: true,
    changedFiles: input.changedFiles.count,
    threshold: input.maxChangedFiles,
    ...(input.review.verdict ? { reviewVerdict: input.review.verdict } : {}),
    ...(state.signals.reviewSummary ? { reviewSummary: state.signals.reviewSummary } : {}),
    concreteBlockers: state.concreteBlockers,
    explanation: releaseScaleExplanation(state.signals),
  };
}

function canEvaluateReleaseScale(input: ReleaseScaleInput): boolean {
  return input.mode !== 'before_edit' && input.changedFiles.available;
}

function releaseScaleSignals(input: ReleaseScaleInput): ReleaseScaleSignals {
  const reviewSummary = input.review.summary;
  const changedFileThresholdExceeded = input.changedFiles.count > input.maxChangedFiles;
  const reviewBlocksOnScale = reviewBlocks(input.review);
  const reviewScaleOnly =
    reviewBlocksOnScale && isScaleComplexityReviewBlock(reviewSummary);
  return {
    detected: changedFileThresholdExceeded || reviewScaleOnly,
    changedFileThresholdExceeded,
    reviewScaleOnly,
    reviewBlocksOnScale,
    ...(reviewSummary ? { reviewSummary } : {}),
    triggers: releaseScaleTriggers(input, changedFileThresholdExceeded, reviewScaleOnly),
  };
}

function releaseScaleTriggers(
  input: ReleaseScaleInput,
  changedFileThresholdExceeded: boolean,
  reviewScaleOnly: boolean,
): string[] {
  const triggers: string[] = [];
  if (changedFileThresholdExceeded) {
    triggers.push(
      `${input.changedFiles.count} changed files exceeds the preflight threshold of ${input.maxChangedFiles}`,
    );
  }
  if (reviewScaleOnly && input.review.summary) {
    triggers.push(`review signal: ${trimTrailingSentencePunctuation(input.review.summary)}`);
  }
  return triggers;
}

function releaseScaleExplanation(signals: ReleaseScaleSignals): string {
  return `Large platform release risk: ${signals.triggers.join('; ')}. ${releaseScaleExplanationTail(signals)}${releaseScaleSignoffTail(signals.reviewSummary)}`;
}

function releaseScaleExplanationTail(signals: ReleaseScaleSignals): string {
  if (signals.reviewScaleOnly) {
    return 'Review blocks on scale/complexity rather than new taint, dataflow, health, plugin, or supply-chain defects.';
  }
  if (signals.reviewBlocksOnScale) {
    return 'Changed-file scale still needs manual release sign-off; inspect the separate review block before continuing.';
  }
  return 'This is a configured scale threshold/manual review signal, not a concrete taint, dataflow, health, plugin, or supply-chain defect.';
}

function releaseScaleSignoffTail(reviewSummary: string | undefined): string {
  if (reviewSummary?.toLowerCase().includes('manual release sign-off')) return '';
  return ' Treat this as a manual release sign-off gate.';
}

function reviewBlocks(review: ReviewEvidence): boolean {
  return review.available && review.verdict === 'block';
}

function isScaleComplexityReviewBlock(summary: string | undefined): boolean {
  if (!summary?.includes('Maximum changed-file risk score')) return false;
  return !summary.includes('new import cycle');
}

function trimTrailingSentencePunctuation(value: string): string {
  return value.trim().replace(/[.]+$/u, '');
}

function concretePreflightBlockers(input: ReleaseScaleInput): string[] {
  const blockers: string[] = [];
  if (input.health.errors > 0) blockers.push('health');
  if (input.supplyChain.errorIssues > 0) blockers.push('supply-chain');
  if (input.issues.some((issue) => issue.id.startsWith('plugin:') && issue.severity === 'error'))
    blockers.push('plugin');
  if ((input.review.newTaintFlows ?? 0) > 0) blockers.push('taint');
  if ((input.review.newDataflowRisks ?? 0) > 0) blockers.push('dataflow');
  return blockers;
}
