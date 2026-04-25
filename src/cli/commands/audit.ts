import ora from 'ora';
import chalk from 'chalk';

import { program, pkg, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { runAudit, auditFindingsToIssues } from '../../core/auditRunner.js';
import { reportAudit } from '../../reporters/consoleReporter.js';
import { reportAuditJson } from '../../reporters/jsonReporter.js';
import { reportAuditMarkdown } from '../../reporters/markdownReporter.js';
import { issuesToSarif } from '../../reporters/sarifReporter.js';

export function registerAudit(): void {
  program
    .command('audit')
    .description('Run npm audit and surface vulnerabilities (SARIF supported)')
    .option('--timeout <ms>', 'override npm audit timeout (default 60000)')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Running npm audit...').start() : null;

      try {
        const timeoutMs = cmdOpts.timeout ? Math.max(5_000, parseInt(cmdOpts.timeout, 10)) : undefined;
        const report = await runAudit(rootPath, timeoutMs !== undefined ? { timeoutMs } : {});
        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportAuditJson(report);
            break;
          case 'markdown':
            reportAuditMarkdown(report);
            break;
          case 'sarif':
            console.log(JSON.stringify(issuesToSarif(auditFindingsToIssues(report), pkg.version), null, 2));
            break;
          default:
            reportAudit(report);
        }
      } catch (error) {
        if (spinner) spinner.fail('Audit failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
