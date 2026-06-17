import { buildChangedReviewReport } from './reviewChangedReport.js';
import { applyReviewIntent } from './reviewIntent.js';
import { resolveReviewState } from './reviewState.js';
import type { ReviewReport } from '../types/review.js';

export { selectReviewTier, shapeReviewForTier } from './reviewTier.js';

export interface ReviewOptions {
  /** Base ref. Default: origin/main → main → origin/master → master → HEAD~1. */
  base?: string;
  /** Head ref. Default: HEAD. */
  head?: string;
  /**
   * 1.9+ — optional free-text PR description. When provided, projscan
   * parses it into an action type + scope tokens, classifies each
   * finding as expected / unexpected / out-of-scope, and surfaces an
   * `intent` echo plus `intentAnalysis` summary in the result. Does
   * NOT affect the verdict — verdict stays structural.
   */
  intent?: string;
  /** Optional workspace package name used to scope every review section before verdicting. */
  package?: string;
}

/**
 * Compose a one-shot PR review. Builds head + base graphs (worktree dance),
 * joins the structural diff with hotspot risk scores, surfaces cycles
 * introduced by the PR, flags newly-risky functions, and reports
 * package.json deltas. Output is shaped for an agent to read once and decide
 * whether to merge, request changes, or escalate.
 *
 * Verdict heuristic (rough; tune with usage):
 *   block  - max changed-file risk >= 80 OR a new cycle includes added files
 *   review - max changed-file risk >= 40 OR new high-CC functions OR
 *            major-dep-bump
 *   ok     - otherwise
 */
export async function computeReview(
  rootPath: string,
  options: ReviewOptions = {},
): Promise<ReviewReport> {
  const state = await resolveReviewState(rootPath, options);
  if (state.kind === 'unavailable') return state.report;
  if (state.kind === 'no-change') {
    applyReviewIntent(state.report, options.intent);
    return state.report;
  }
  return buildChangedReviewReport(rootPath, options, state);
}
