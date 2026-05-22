import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeRegressionPlan } from '../../core/regressionPlan.js';
import type { RegressionPlanLevel, RegressionPlanReport, RegressionPlanTarget } from '../../types.js';

export function registerRegressionPlan(): void {
  program
    .command('regression-plan')
    .description('Build a smoke, focused, or full regression matrix from product risk signals')
    .option('--level <level>', 'smoke, focused, or full', 'focused')
    .option('--line <line>', 'product line to include, repeatable (default: next six minor lines)', collectLine, [])
    .option('--max-targets <count>', 'maximum regression targets to include', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('regression-plan');
      const level = parseLevel(cmdOpts.level);

      try {
        const report = await computeRegressionPlan(getRootPath(), {
          level,
          lines: cmdOpts.line,
          maxTargets: cmdOpts.maxTargets,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printRegressionPlan(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function collectLine(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseLevel(value: unknown): RegressionPlanLevel {
  if (value === 'smoke' || value === 'focused' || value === 'full') return value;
  console.error(chalk.red(`Unsupported --level ${String(value)}.`));
  console.error(chalk.dim('Supported levels: smoke, focused, full'));
  process.exit(1);
}

function printRegressionPlan(report: RegressionPlanReport): void {
  const color =
    report.verdict === 'blocked'
      ? chalk.red
      : report.verdict === 'needs_tests'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Regression Plan: ${report.verdict} (${report.level})`));
  console.log(report.summary);
  console.log(`Product lines: ${report.releaseLines.join(', ')}`);
  console.log('');
  console.log(chalk.bold('Targets'));
  for (const target of report.targets) {
    printTarget(target);
  }
  console.log('');
  console.log(chalk.bold('Commands'));
  for (const command of report.commands) {
    console.log(`- ${command}`);
  }
}

function printTarget(target: RegressionPlanTarget): void {
  const files = target.files.length > 0 ? ` (${target.files.join(', ')})` : '';
  console.log(`- ${chalk.bold(`[${target.priority}] ${target.title}`)}${files}`);
  console.log(`  ${target.why}`);
  console.log(`  verify: ${target.verification.commands.join(' && ')}`);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
