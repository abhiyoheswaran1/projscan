import chalk from 'chalk';
import type { ScoreBreakdown } from '../types.js';

export function printScoreBreakdown(breakdown: ScoreBreakdown | undefined): void {
  if (!breakdown || breakdown.uncappedPenalty <= 0) return;

  console.log(
    `  Score breakdown: ${breakdown.baseScore} - ${breakdown.totalPenalty} penalty = ${breakdown.finalScore}`,
  );
  console.log(`    ${severityParts(breakdown).join('; ')}`);

  const categories = breakdown.byCategory.filter((entry) => entry.penalty > 0);
  if (categories.length > 0) {
    console.log(
      `    ${chalk.dim('categories:')} ${categories
        .map((entry) => `${entry.category} -${entry.penalty}`)
        .join(', ')}`,
    );
  }
}

function severityParts(breakdown: ScoreBreakdown): string[] {
  return (['error', 'warning', 'info'] as const)
    .map((severity) => {
      const item = breakdown.bySeverity[severity];
      if (item.count === 0) return null;
      return `${severity}: ${item.count} x ${item.weight} = -${item.penalty}`;
    })
    .filter((part): part is string => Boolean(part));
}
