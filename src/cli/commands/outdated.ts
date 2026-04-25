import ora from 'ora';
import chalk from 'chalk';

import { program, pkg, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { detectOutdated } from '../../core/outdatedDetector.js';
import { detectWorkspaces } from '../../core/monorepo.js';
import { reportOutdated } from '../../reporters/consoleReporter.js';
import { reportOutdatedJson } from '../../reporters/jsonReporter.js';
import { reportOutdatedMarkdown } from '../../reporters/markdownReporter.js';
import { issuesToSarif } from '../../reporters/sarifReporter.js';

export function registerOutdated(): void {
  program
    .command('outdated')
    .description('Detect outdated dependencies (offline - compares declared vs installed). Workspace-aware in monorepos.')
    .option('--package <name>', 'monorepo: scope to a single workspace package')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Checking dependencies...').start() : null;

      try {
        const workspaces = await detectWorkspaces(rootPath);
        const report = await detectOutdated(rootPath, {
          workspaces,
          ...(cmdOpts.package ? { workspaceFilter: cmdOpts.package } : {}),
        });
        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportOutdatedJson(report);
            break;
          case 'markdown':
            reportOutdatedMarkdown(report);
            break;
          case 'sarif':
            console.log(JSON.stringify(issuesToSarif([], pkg.version), null, 2));
            break;
          default:
            reportOutdated(report);
        }
      } catch (error) {
        if (spinner) spinner.fail('Outdated check failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
