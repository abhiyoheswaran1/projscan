import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeBugHunt } from '../../core/bugHunt.js';
import type { BugHuntFinding, BugHuntReport } from '../../types.js';

const REVIEW_SIGNAL_FILE_PREVIEW_LIMIT = 3;

export function registerBugHunt(): void {
  program
    .command('bug-hunt')
    .description(
      'Prioritize a bug-hunt action queue from repo health, hotspots, preflight, and session evidence',
    )
    .option('--max-findings <count>', 'maximum number of findings to return', parsePositiveInt)
    .option('--since <when>', 'git history window for hotspot evidence')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('bug-hunt');

      try {
        const report = await computeBugHunt(getRootPath(), {
          maxFindings: cmdOpts.maxFindings,
          since: cmdOpts.since,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printBugHunt(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printBugHunt(report: BugHuntReport): void {
  const displayVerdict = bugHuntDisplayVerdict(report);
  const color =
    report.verdict === 'block' ? chalk.red : displayVerdict === 'clean' ? chalk.green : chalk.yellow;
  console.log(color(`Bug Hunt: ${displayVerdict}`));
  console.log(report.summary);
  console.log('');
  printFindingSection(report);
  console.log('');
  console.log(chalk.bold('Verify'));
  for (const entry of report.verificationMatrix) {
    console.log(`- ${entry.command}`);
  }
}

function printFindingSection(report: BugHuntReport): void {
  if (report.fixQueue.length > 0) {
    console.log(chalk.bold('Action Queue'));
    for (const finding of report.fixQueue) printFinding(finding);
    return;
  }

  const reviewSignals =
    report.verdict === 'review'
      ? (report.reviewQueue ?? report.topSuspects).filter(isReviewSignal)
      : [];
  if (reviewSignals.length === 0) return;

  console.log(chalk.bold('Review Signals'));
  for (const finding of reviewSignals)
    printFinding(finding, { maxFiles: REVIEW_SIGNAL_FILE_PREVIEW_LIMIT });
}

function printFinding(
  finding: BugHuntFinding,
  options: { maxFiles?: number } = {},
): void {
  const files = findingFileSummary(finding.files, options.maxFiles);
  console.log(`- ${chalk.bold(`[${finding.priority}] ${finding.title}`)}${files}`);
  console.log(`  ${finding.why}`);
  console.log(`  verify: ${finding.verification.commands.join(' && ')}`);
}

function findingFileSummary(files: string[], maxFiles?: number): string {
  if (files.length === 0) return '';
  if (!maxFiles || files.length <= maxFiles) return ` (${files.join(', ')})`;
  return ` (${files.slice(0, maxFiles).join(', ')}, +${files.length - maxFiles} more)`;
}

function isReviewSignal(finding: BugHuntFinding): boolean {
  return (
    finding.source === 'preflight' && finding.evidence.some((entry) => entry.source === 'release')
  );
}

function bugHuntDisplayVerdict(report: BugHuntReport): BugHuntReport['verdict'] | 'review' {
  if (report.summary.startsWith('review:') && report.summary.includes('manual sign-off action')) {
    return 'review';
  }
  return report.verdict;
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
