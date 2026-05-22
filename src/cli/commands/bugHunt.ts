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

export function registerBugHunt(): void {
  program
    .command('bug-hunt')
    .description('Prioritize a bug-hunt fix queue from repo health, hotspots, preflight, and session evidence')
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
  const color = report.verdict === 'block' ? chalk.red : report.verdict === 'fix' ? chalk.yellow : chalk.green;
  console.log(color(`Bug Hunt: ${report.verdict}`));
  console.log(report.summary);
  console.log('');
  console.log(chalk.bold('Fix Queue'));
  for (const finding of report.fixQueue) {
    printFinding(finding);
  }
  console.log('');
  console.log(chalk.bold('Verify'));
  for (const entry of report.verificationMatrix) {
    console.log(`- ${entry.command}`);
  }
}

function printFinding(finding: BugHuntFinding): void {
  const files = finding.files.length > 0 ? ` (${finding.files.join(', ')})` : '';
  console.log(`- ${chalk.bold(`[${finding.priority}] ${finding.title}`)}${files}`);
  console.log(`  ${finding.why}`);
  console.log(`  verify: ${finding.verification.commands.join(' && ')}`);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
