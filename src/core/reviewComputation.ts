import { buildChangedReviewReport } from './reviewChangedReport.js';
import { applyReviewIntent } from './reviewIntent.js';
import { resolveReviewState } from './reviewState.js';
import type { ReviewReport } from '../types/review.js';

interface ReviewComputationOptions {
  base?: string;
  head?: string;
  intent?: string;
  package?: string;
}

export async function computeReviewReport(
  rootPath: string,
  options: ReviewComputationOptions = {},
): Promise<ReviewReport> {
  const state = await resolveReviewState(rootPath, options);
  if (state.kind === 'unavailable') return state.report;
  if (state.kind === 'no-change') {
    applyReviewIntent(state.report, options.intent);
    return state.report;
  }
  return buildChangedReviewReport(rootPath, options, state);
}
