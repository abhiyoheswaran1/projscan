import type { ReviewReport } from '../types/review.js';
import { annotateReviewWithIntent, appendIntentToSummary, parseIntent } from './intent.js';

export function applyReviewIntent(report: ReviewReport, rawIntent?: string): void {
  const intent = parseIntent(rawIntent);
  if (!intent) return;

  const analysis = annotateReviewWithIntent(report, intent);
  report.intent = {
    raw: intent.raw,
    action: intent.action,
    scopeTokens: intent.scopeTokens,
  };
  report.intentAnalysis = {
    totals: analysis.totals,
    notable: analysis.notable,
  };
  appendIntentToSummary(report.summary, analysis);
}
