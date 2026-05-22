import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeQualityScorecard } from '../../core/qualityScorecard.js';
import type { QualityScorecardDimension, QualityScorecardReport } from '../../types.js';

export function registerQualityScorecard(): void {
  program
    .command('quality-scorecard')
    .description('Summarize quality dimensions, top risks, and verification commands')
    .option('--max-risks <count>', 'maximum top risks to return', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('quality-scorecard');

      try {
        const report = await computeQualityScorecard(getRootPath(), {
          maxRisks: cmdOpts.maxRisks,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printQualityScorecard(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printQualityScorecard(report: QualityScorecardReport): void {
  const color =
    report.verdict === 'blocked'
      ? chalk.red
      : report.verdict === 'needs_attention'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Quality Scorecard: ${report.verdict}`));
  console.log(report.summary);
  console.log('');
  console.log(chalk.bold('Dimensions'));
  for (const dimension of report.dimensions) {
    printDimension(dimension);
  }
  console.log('');
  console.log(chalk.bold('Top Risks'));
  for (const risk of report.topRisks) {
    const files = risk.files.length > 0 ? ` (${risk.files.join(', ')})` : '';
    console.log(`- [${risk.priority}] ${risk.title}${files}`);
  }
}

function printDimension(dimension: QualityScorecardDimension): void {
  console.log(`- ${chalk.bold(`[${dimension.status}] ${dimension.label}`)} ${dimension.score}/100`);
  console.log(`  ${dimension.summary}`);
  console.log(`  run: ${dimension.commands.join(' && ')}`);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
