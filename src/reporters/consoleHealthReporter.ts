import chalk from 'chalk';
import type { Issue } from '../types.js';
import { calculateScore } from '../utils/scoreCalculator.js';

export interface ReportHealthOptions {
  /** Scan duration in milliseconds; surfaced under the score line. */
  scanTimeMs?: number;
  /**
   * 1.5+ — count of stable rules from Project Memory. When ≥ 1, doctor
   * surfaces a one-line tip pointing at `projscan memory stable`.
   * Caller (the doctor CLI) is responsible for loading memory and
   * passing the count; reporters stay sync.
   */
  stableRuleCount?: number;
}

export function reportHealth(
  issues: Issue[],
  scanTimeMsOrOptions?: number | ReportHealthOptions,
): void {
  const opts = normalizeHealthOptions(scanTimeMsOrOptions);
  console.log(header('Project Health Report'));
  printHealthScore(issues);

  if (issues.length === 0) {
    printNoIssues();
    return;
  }

  printIssueSummary(issues);
  printScanTime(opts);
  printIssueDetails(issues);
  printRecommendations(issues);
  printStableRuleTip(opts);
  printNextCommands();
  console.log('');
}

function normalizeHealthOptions(
  scanTimeMsOrOptions?: number | ReportHealthOptions,
): ReportHealthOptions {
  return typeof scanTimeMsOrOptions === 'number'
    ? { scanTimeMs: scanTimeMsOrOptions }
    : (scanTimeMsOrOptions ?? {});
}

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

function gradeColor(grade: string): (message: string) => string {
  if (grade === 'A' || grade === 'B') return chalk.green;
  if (grade === 'C' || grade === 'D') return chalk.yellow;
  return chalk.red;
}

function printHealthScore(issues: Issue[]): void {
  const { score, grade } = calculateScore(issues);
  const color = gradeColor(grade);
  console.log(`\n  Health Score: ${color(chalk.bold(`${grade} (${score}/100)`))}`);
}

function printNoIssues(): void {
  console.log(
    `  ${chalk.green('✓')} ${chalk.bold('No issues detected!')} Your project looks healthy.\n`,
  );
}

function printIssueSummary(issues: Issue[]): void {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const infos = issues.filter((issue) => issue.severity === 'info');
  const parts = issueSummaryParts(errors.length, warnings.length, infos.length);
  console.log(`  Found ${parts.join(', ')}`);
}

function issueSummaryParts(errors: number, warnings: number, infos: number): string[] {
  const parts: string[] = [];
  if (errors > 0) parts.push(chalk.red(`${errors} error${errors > 1 ? 's' : ''}`));
  if (warnings > 0) parts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`));
  if (infos > 0) parts.push(chalk.blue(`${infos} info`));
  return parts;
}

function printScanTime(opts: ReportHealthOptions): void {
  if (opts.scanTimeMs !== undefined) {
    console.log(`  Scanned in ${chalk.dim(opts.scanTimeMs.toFixed(0) + 'ms')}`);
  }
}

function printIssueDetails(issues: Issue[]): void {
  console.log(header('Issues Detected'));
  for (const issue of issues) {
    console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
    console.log(`    ${chalk.dim(issue.description)}`);
    printSuggestedAction(issue);
  }
}

function printSuggestedAction(issue: Issue): void {
  if (!issue.suggestedAction) return;
  console.log(
    `    ${chalk.cyan('→')} ${chalk.dim(issue.suggestedAction.summary)} ${chalk.dim(`(projscan fix-suggest ${issue.id})`)}`,
  );
}

function printRecommendations(issues: Issue[]): void {
  const fixable = issues.filter((issue) => issue.fixAvailable);
  if (fixable.length === 0) return;

  console.log(header('Recommendations'));
  for (let i = 0; i < fixable.length; i++) {
    console.log(`  ${chalk.bold(String(i + 1) + '.')} Fix: ${fixable[i].title}`);
  }
  console.log(
    `\n  Run ${chalk.bold.cyan('projscan fix')} to auto-fix ${fixable.length} issue${fixable.length > 1 ? 's' : ''}.\n`,
  );
}

function printStableRuleTip(opts: ReportHealthOptions): void {
  if (!opts.stableRuleCount || opts.stableRuleCount <= 0) return;

  console.log(
    `  ${chalk.cyan('▲')} ${chalk.dim(`${opts.stableRuleCount} rule${opts.stableRuleCount === 1 ? ' has' : 's have'} been open across enough runs to count as accepted. Run`)} ${chalk.bold.cyan('projscan memory stable')} ${chalk.dim('to review and silence them in .projscanrc.')}\n`,
  );
}

function printNextCommands(): void {
  console.log(header('Next best commands'));
  console.log(
    `  ${chalk.cyan('projscan preflight --mode before_edit --format json')} ${chalk.dim('for an agent-sized safety gate')}`,
  );
  console.log(
    `  ${chalk.cyan('projscan bug-hunt --format json')} ${chalk.dim('for a ranked action queue')}`,
  );
  console.log(`  ${chalk.cyan('projscan recipes')} ${chalk.dim('for repeatable agent workflows')}`);
}
