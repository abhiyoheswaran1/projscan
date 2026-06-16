import type { AuthorShare } from '../types.js';

interface ScoreInputs {
  churn: number;
  lines: number;
  /**
   * AST cyclomatic complexity. When null (no adapter parsed this file or
   * parse failed), the score falls back to `lines` so non-AST languages
   * like Ruby/Go/Java still rank.
   */
  complexity?: number | null;
  authors: number;
  daysSinceLastChange: number | null;
  issueCount: number;
  busFactorOne?: boolean;
  coverage?: number | null;
}

export function computeRiskScore(i: ScoreInputs): number {
  // 0.11: complexity replaces LOC as the second-axis "scariness" signal.
  // CC is a tighter proxy for control-flow risk than raw line count, but a
  // 200-line file might score CC=15 instead of LOC=200, so absolute scores
  // shift down for adapter-parsed files. Rankings are what matter.
  const cx = complexityAxis(i);
  const churnWeight = Math.log2(1 + i.churn) * 20;
  const complexityWeight = Math.log2(1 + cx) * 4;
  const hotChurnXComplexity = Math.log2(1 + i.churn) * Math.log2(1 + cx) * 3;
  const authorWeight = Math.log2(1 + i.authors) * 5;
  const issueWeight = i.issueCount * 12;
  const busFactorPenalty = i.busFactorOne ? 15 : 0;

  const raw =
    churnWeight +
    complexityWeight +
    hotChurnXComplexity +
    authorWeight +
    issueWeight +
    recencyBoost(i.daysSinceLastChange) +
    busFactorPenalty +
    coveragePenalty(i.coverage, i.churn);

  if (i.churn === 0 && i.issueCount === 0) return 0;

  return Math.round(raw * 10) / 10;
}

function complexityAxis(i: ScoreInputs): number {
  return typeof i.complexity === 'number' ? i.complexity : i.lines;
}

function recencyBoost(daysSinceLastChange: number | null): number {
  if (daysSinceLastChange === null) return 0;
  if (daysSinceLastChange <= 7) return 10;
  if (daysSinceLastChange <= 30) return 6;
  if (daysSinceLastChange <= 90) return 3;
  return 0;
}

function coveragePenalty(coverage: number | null | undefined, churn: number): number {
  if (typeof coverage !== 'number' || churn === 0) return 0;
  const uncoveredFraction = Math.max(0, (100 - coverage) / 100);
  return uncoveredFraction * Math.log2(1 + churn) * 4;
}

interface ReasonInputs extends ScoreInputs {
  primaryAuthor?: string | null;
}

export function buildReasons(i: ReasonInputs): string[] {
  const reasons: string[] = [];
  pushChurnReason(reasons, i);
  pushSizeReason(reasons, i);
  pushAuthorsReason(reasons, i);
  pushIssuesReason(reasons, i);
  pushRecencyReason(reasons, i);
  pushBusFactorReason(reasons, i);
  pushCoverageReason(reasons, i);
  return reasons;
}

function pushChurnReason(reasons: string[], i: ReasonInputs): void {
  if (i.churn >= 20) reasons.push(`high churn (${i.churn} commits)`);
  else if (i.churn >= 8) reasons.push(`frequent changes (${i.churn} commits)`);
  else if (i.churn > 0) reasons.push(`${i.churn} commit${i.churn === 1 ? '' : 's'}`);
}

/**
 * When CC is available, prefer it over raw line count - it's the more
 * honest signal. Fall back to "large file (lines)" for non-AST
 * languages.
 */
function pushSizeReason(reasons: string[], i: ReasonInputs): void {
  if (typeof i.complexity === 'number') {
    if (i.complexity >= 30) reasons.push(`high complexity (CC ${i.complexity})`);
    else if (i.complexity >= 15) reasons.push(`moderate complexity (CC ${i.complexity})`);
    return;
  }
  if (i.lines >= 500) reasons.push(`large file (${i.lines} lines)`);
  else if (i.lines >= 250) reasons.push(`${i.lines} lines`);
}

function pushAuthorsReason(reasons: string[], i: ReasonInputs): void {
  if (i.authors >= 2) reasons.push(`${i.authors} contributors`);
}

function pushIssuesReason(reasons: string[], i: ReasonInputs): void {
  if (i.issueCount > 0) {
    reasons.push(`${i.issueCount} open issue${i.issueCount === 1 ? '' : 's'}`);
  }
}

function pushRecencyReason(reasons: string[], i: ReasonInputs): void {
  if (i.daysSinceLastChange !== null && i.daysSinceLastChange <= 7) {
    reasons.push('changed this week');
  }
}

function pushBusFactorReason(reasons: string[], i: ReasonInputs): void {
  if (i.busFactorOne && i.primaryAuthor) {
    reasons.push(`bus factor 1 (${formatAuthor(i.primaryAuthor)})`);
  }
}

function pushCoverageReason(reasons: string[], i: ReasonInputs): void {
  if (typeof i.coverage !== 'number' || i.churn === 0) return;
  if (i.coverage < 40) reasons.push(`low coverage (${Math.round(i.coverage)}%)`);
  else if (i.coverage < 70) reasons.push(`moderate coverage (${Math.round(i.coverage)}%)`);
}

export function rankAuthors(authorCommits: Map<string, number> | undefined): AuthorShare[] {
  if (!authorCommits || authorCommits.size === 0) return [];
  const total = [...authorCommits.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];

  return [...authorCommits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([author, commits]) => ({
      author,
      commits,
      share: Math.round((commits / total) * 1000) / 1000,
    }));
}

function formatAuthor(email: string): string {
  const atIdx = email.indexOf('@');
  return atIdx > 0 ? email.slice(0, atIdx) : email;
}
