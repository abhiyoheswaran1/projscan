import ora from 'ora';
import chalk from 'chalk';

import {
  program,
  getRootPath,
  setupLogLevel,
  maybeCompactBanner,
  assertFormatSupported,
} from '../_shared.js';
import { computeReview } from '../../core/review.js';
import { reportReview } from '../../reporters/consoleReporter.js';
import { reportReviewJson } from '../../reporters/jsonReporter.js';
import { reportReviewMarkdown } from '../../reporters/markdownReporter.js';
import { reportReviewHtml } from '../../reporters/htmlReporter.js';

export function registerReview(): void {
  program
    .command('review')
    .description(
      'One-shot PR review: structural diff + risk + cycles + risky functions + dep changes + verdict',
    )
    .option('--base <ref>', 'base ref (default: origin/main, falling back to main/master/HEAD~1)')
    .option('--head <ref>', 'head ref (default: HEAD)')
    .option('--package <name>', 'monorepo: scope review to a single workspace package')
    .action(async (cmdOpts: { base?: string; head?: string; package?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = assertFormatSupported('review');
      const spinner = format === 'console' ? ora('Reviewing PR...').start() : null;

      try {
        const report = await computeReview(rootPath, {
          base: cmdOpts.base,
          head: cmdOpts.head,
          package: cmdOpts.package,
        });

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportReviewJson(report);
            break;
          case 'markdown':
            reportReviewMarkdown(report);
            break;
          case 'html':
            reportReviewHtml(report);
            break;
          default:
            reportReview(report);
        }
      } catch (error) {
        if (spinner) spinner.fail('PR review failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
