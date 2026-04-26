import ora from 'ora';
import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { analyzeDependencies } from '../../core/dependencyAnalyzer.js';
import { reportDependencies } from '../../reporters/consoleReporter.js';
import { reportDependenciesJson } from '../../reporters/jsonReporter.js';
import { reportDependenciesMarkdown } from '../../reporters/markdownReporter.js';

export function registerDependencies(): void {
  program
    .command('dependencies')
    .description('Analyze project dependencies (workspace-aware in monorepos)')
    .option('--package <name>', 'monorepo: scope analysis to a single workspace package')
    .action(async (cmdOpts: { package?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Analyzing dependencies...').start() : null;

      try {
        const report = await analyzeDependencies(rootPath, { packageFilter: cmdOpts.package });

        if (spinner) spinner.stop();

        if (!report) {
          console.log(chalk.yellow('\n  No package.json found in this directory.\n'));
          return;
        }

        switch (format) {
          case 'json':
            reportDependenciesJson(report);
            break;
          case 'markdown':
            reportDependenciesMarkdown(report);
            break;
          default:
            reportDependencies(report);
        }
      } catch (error) {
        if (spinner) spinner.fail('Dependency analysis failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
