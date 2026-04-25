import ora from 'ora';
import chalk from 'chalk';

import {
  program,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
  promptYesNo,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { applyConfigToIssues } from '../../utils/config.js';
import { getAllAvailableFixes } from '../../fixes/fixRegistry.js';
import { reportDetectedIssues } from '../../reporters/consoleReporter.js';
import type { FixResult } from '../../types.js';

export function registerFix(): void {
  program
    .command('fix')
    .description('Auto-fix detected project issues')
    .option('-y, --yes', 'apply fixes without prompting')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const spinner = ora('Detecting issues...').start();
      const config = await loadProjectConfig();

      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        let issues = await collectIssues(rootPath, scan.files);
        issues = applyConfigToIssues(issues, config);
        const fixes = getAllAvailableFixes(issues);

        spinner.stop();

        if (fixes.length === 0) {
          console.log(`\n  ${chalk.green('✓')} ${chalk.bold('No fixable issues found!')}\n`);
          return;
        }

        reportDetectedIssues(issues, fixes);

        if (!cmdOpts.yes) {
          const proceed = await promptYesNo(`  Apply ${fixes.length} fix${fixes.length > 1 ? 'es' : ''}? (y/n) `);
          if (!proceed) {
            console.log(chalk.dim('\n  Aborted.\n'));
            return;
          }
        }

        const results: FixResult[] = [];
        for (const fix of fixes) {
          const fixSpinner = ora(`  Applying: ${fix.title}...`).start();
          try {
            await fix.apply(rootPath);
            fixSpinner.succeed(`  ${fix.title}`);
            results.push({ fix, success: true });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            fixSpinner.fail(`  ${fix.title}`);
            results.push({ fix, success: false, error: msg });
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        console.log('');
        if (succeeded > 0) {
          console.log(`  ${chalk.green('✓')} ${succeeded} fix${succeeded > 1 ? 'es' : ''} applied successfully`);
        }
        if (failed > 0) {
          console.log(`  ${chalk.red('✗')} ${failed} fix${failed > 1 ? 'es' : ''} failed`);
        }
        console.log('');
      } catch (error) {
        spinner.fail('Fix detection failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
