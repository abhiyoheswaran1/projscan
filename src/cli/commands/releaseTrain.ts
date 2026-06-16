import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeReleaseTrain } from '../../core/releaseTrain.js';
import type { ReleaseTrainReport, ReleaseTrainTask } from '../../types.js';

export function registerReleaseTrain(): void {
  program
    .command('release-train')
    .description('Plan upcoming product lines with readiness evidence')
    .option(
      '--line <line>',
      'product line to include, repeatable (default: next six minor lines)',
      collectLine,
      [],
    )
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('release-train');

      try {
        const report = await computeReleaseTrain(getRootPath(), {
          lines: cmdOpts.line,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printReleaseTrain(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function collectLine(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function printReleaseTrain(report: ReleaseTrainReport): void {
  const color =
    report.readiness.verdict === 'block'
      ? chalk.red
      : report.readiness.verdict === 'caution'
        ? chalk.yellow
        : chalk.green;
  console.log(color('Readiness Plan'));
  console.log(`Current version: ${report.currentVersion ?? 'unknown'}`);
  console.log(`Product lines: ${report.plan.lines.join(', ')}`);
  console.log('');
  console.log(chalk.bold('Tracks'));
  for (const track of report.tracks) {
    console.log(`- ${track.line}: ${track.theme}`);
    console.log(`  ${track.outcome}`);
  }
  console.log('');
  console.log(chalk.bold('Tasks'));
  for (const task of report.tasks) {
    printTask(task);
  }
}

function printTask(task: ReleaseTrainTask): void {
  console.log(`- ${chalk.bold(`[${task.priority}] ${task.title}`)} (${task.track})`);
  console.log(`  ${task.why}`);
  console.log(`  verify: ${task.verification.commands.join(' && ')}`);
}
