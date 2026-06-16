import chalk from 'chalk';
import type { CoverageJoinedReport } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportCoverage(report: CoverageJoinedReport): void {
  if (!report.available) {
    printUnavailableCoverage(report);
    return;
  }

  printCoverageReport(report);
}

function printUnavailableCoverage(report: CoverageJoinedReport): void {
  console.log(chalk.yellow(`\n  ${report.reason ?? 'Coverage report unavailable'}\n`));
}

function printCoverageReport(report: CoverageJoinedReport): void {
  console.log(header('Coverage × Hotspots - "Scariest Untested Files"'));
  printCoverageSource(report);

  if (report.entries.length === 0) {
    printEmptyCoverageIntersection();
    return;
  }

  printCoverageEntries(report);
  printCoverageOverflow(report);
}

function printCoverageSource(report: CoverageJoinedReport): void {
  const src = report.coverageSourceFile ? ` (${report.coverageSourceFile})` : '';
  console.log(chalk.dim(`  Source: ${report.coverageSource}${src}`));
  console.log('');
}

function printEmptyCoverageIntersection(): void {
  console.log(`  ${chalk.green('✓')} No hotspots intersected with coverage data.\n`);
}

function printCoverageEntries(report: CoverageJoinedReport): void {
  for (const e of report.entries.slice(0, 20)) {
    const covStr = e.coverage === null ? chalk.dim('n/a') : formatCoverage(e.coverage);
    const pri = chalk.bold(e.priority.toFixed(1).padStart(6));
    console.log(
      `  ${pri}  cov ${covStr}  risk ${chalk.dim(e.riskScore.toFixed(1))}  churn ${chalk.dim(String(e.churn))}  ${chalk.bold(e.relativePath)}`,
    );
    if (e.reasons.length > 0) {
      console.log(`         ${chalk.dim(e.reasons.join(', '))}`);
    }
  }
}

function printCoverageOverflow(report: CoverageJoinedReport): void {
  if (report.entries.length > 20) {
    console.log(chalk.dim(`\n  … and ${report.entries.length - 20} more.\n`));
  } else {
    console.log('');
  }
}

function formatCoverage(pct: number): string {
  const padded = `${pct.toFixed(0)}%`.padStart(4);
  if (pct < 40) return chalk.red(padded);
  if (pct < 70) return chalk.yellow(padded);
  if (pct < 90) return chalk.blue(padded);
  return chalk.green(padded);
}
