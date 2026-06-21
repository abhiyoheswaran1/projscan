import type { Issue, HealthScore, IssueSeverity, ScoreBreakdown } from '../types.js';

const BASE_SCORE = 100;
const SEVERITY_WEIGHTS: Record<IssueSeverity, number> = {
  error: 20,
  warning: 10,
  info: 3,
};

/**
 * Calculate a project health score (0–100) and letter grade from detected issues.
 *
 * Deductions:
 *   error   → -20 points each
 *   warning → -10 points each
 *   info    → -3 points each
 *
 * Grade thresholds:
 *   A  90–100
 *   B  80–89
 *   C  70–79
 *   D  60–69
 *   F  < 60
 */
export function calculateScore(issues: Issue[]): HealthScore {
  const errors = countSeverity(issues, 'error');
  const warnings = countSeverity(issues, 'warning');
  const infos = countSeverity(issues, 'info');
  const uncappedPenalty =
    penaltyFor('error', errors) + penaltyFor('warning', warnings) + penaltyFor('info', infos);
  const totalPenalty = Math.min(BASE_SCORE, uncappedPenalty);
  const score = Math.max(0, BASE_SCORE - uncappedPenalty);
  const grade = gradeForScore(score);

  return {
    score,
    grade,
    errors,
    warnings,
    infos,
    scoreBreakdown: buildScoreBreakdown(issues, {
      score,
      grade,
      errors,
      warnings,
      infos,
      totalPenalty,
      uncappedPenalty,
    }),
  };
}

function countSeverity(issues: Issue[], severity: IssueSeverity): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

function penaltyFor(severity: IssueSeverity, count: number): number {
  return count * SEVERITY_WEIGHTS[severity];
}

function gradeForScore(score: number): HealthScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function buildScoreBreakdown(
  issues: Issue[],
  score: HealthScore & { totalPenalty: number; uncappedPenalty: number },
): ScoreBreakdown {
  return {
    baseScore: BASE_SCORE,
    finalScore: score.score,
    grade: score.grade,
    totalPenalty: score.totalPenalty,
    uncappedPenalty: score.uncappedPenalty,
    bySeverity: {
      error: severityBreakdown(score.errors, 'error'),
      warning: severityBreakdown(score.warnings, 'warning'),
      info: severityBreakdown(score.infos, 'info'),
    },
    byCategory: categoryBreakdown(issues),
  };
}

function severityBreakdown(count: number, severity: IssueSeverity) {
  const weight = SEVERITY_WEIGHTS[severity];
  return { count, weight, penalty: count * weight };
}

function categoryBreakdown(issues: Issue[]): ScoreBreakdown['byCategory'] {
  const categories = new Map<string, { count: number; penalty: number }>();
  for (const issue of issues) {
    const category = issue.category || 'uncategorized';
    const current = categories.get(category) ?? { count: 0, penalty: 0 };
    current.count += 1;
    current.penalty += SEVERITY_WEIGHTS[issue.severity];
    categories.set(category, current);
  }
  return [...categories.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, value]) => ({ category, ...value }));
}

const GRADE_COLORS: Record<HealthScore['grade'], string> = {
  A: 'brightgreen',
  B: 'green',
  C: 'yellow',
  D: 'orange',
  F: 'red',
};

export function badgeUrl(grade: HealthScore['grade']): string {
  const color = GRADE_COLORS[grade];
  return `https://img.shields.io/badge/projscan-${grade}-${color}`;
}

export function badgeMarkdown(grade: HealthScore['grade']): string {
  return `[![projscan health](${badgeUrl(grade)})](https://github.com/abhiyoheswaran1/projscan)`;
}
