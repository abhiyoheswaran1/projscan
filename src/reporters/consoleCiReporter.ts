import chalk from 'chalk';
import type { Issue } from '../types.js';
import { calculateScore } from '../utils/scoreCalculator.js';

function severityIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return chalk.red('✗');
    case 'warning':
      return chalk.yellow('⚠');
    case 'info':
      return chalk.blue('ℹ');
    default:
      return chalk.dim('·');
  }
}

export function reportCi(issues: Issue[], threshold: number): void {
  const { score, grade, errors, warnings, infos } = calculateScore(issues);
  const pass = score >= threshold;
  const status = pass ? chalk.green('PASS') : chalk.red('FAIL');
  const gradeColor =
    grade === 'A' || grade === 'B' ? chalk.green : grade === 'C' ? chalk.yellow : chalk.red;

  console.log(
    `projscan: ${gradeColor(chalk.bold(`${grade} (${score}/100)`))} - ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}, ${infos} info - ${status} (threshold: ${threshold})`,
  );

  if (!pass) {
    for (const issue of issues) {
      console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
    }
  }
}
