import type { Issue, HealthScore } from '../types.js';

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
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  const deductions = errors * 20 + warnings * 10 + infos * 3;
  const score = Math.max(0, 100 - deductions);

  let grade: HealthScore['grade'];
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return { score, grade, errors, warnings, infos };
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
