import ora from 'ora';
import chalk from 'chalk';

import {
  program,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { applyConfigToIssues } from '../../utils/config.js';
import { calculateScore, badgeUrl, badgeMarkdown } from '../../utils/scoreCalculator.js';

export function registerBadge(): void {
  program
    .command('badge')
    .description('Generate a health badge for your README')
    .option('--markdown', 'output as markdown image link')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const spinner = ora('Calculating health score...').start();
      const config = await loadProjectConfig();

      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        let issues = await collectIssues(rootPath, scan.files);
        issues = applyConfigToIssues(issues, config);
        const { score, grade } = calculateScore(issues);

        spinner.stop();

        const gradeColor = grade === 'A' || grade === 'B' ? chalk.green : grade === 'C' ? chalk.yellow : chalk.red;
        console.log(`\n  Health Score: ${gradeColor(chalk.bold(`${grade} (${score}/100)`))}\n`);

        if (cmdOpts.markdown) {
          console.log(`  ${badgeMarkdown(grade)}\n`);
        } else {
          console.log(`  ${chalk.bold('Badge URL:')}`);
          console.log(`  ${badgeUrl(grade)}\n`);
          console.log(`  ${chalk.bold('Markdown:')}`);
          console.log(`  ${badgeMarkdown(grade)}\n`);
        }
        console.log(chalk.dim('  Add this to your README to show your project health score.\n'));
      } catch (error) {
        spinner.fail('Badge generation failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
