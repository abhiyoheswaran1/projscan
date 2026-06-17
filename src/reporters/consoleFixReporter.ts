import chalk from 'chalk';
import type { Fix, FixResult, Issue } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

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

export function reportDetectedIssues(issues: Issue[], fixes: Fix[]): void {
  console.log(header('Detected Issues'));
  for (const issue of issues.filter((i) => i.fixAvailable)) {
    console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
  }

  console.log(header('Proposed Fixes'));
  for (let i = 0; i < fixes.length; i++) {
    console.log(`  ${chalk.bold(String(i + 1) + '.')} ${fixes[i].title}`);
  }
  console.log('');
}

export function reportFixResults(results: FixResult[]): void {
  console.log('');
  for (const result of results) {
    if (result.success) {
      console.log(`  ${chalk.green('✔')} ${result.fix.title}`);
    } else {
      console.log(
        `  ${chalk.red('✗')} ${result.fix.title} - ${chalk.dim(result.error ?? 'unknown error')}`,
      );
    }
  }
  console.log('');
}
