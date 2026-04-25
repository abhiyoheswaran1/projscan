import ora from 'ora';
import chalk from 'chalk';

import {
  program,
  pkg,
  getFormat,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
  filterIssuesByChangedFiles,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import { applyConfigToIssues } from '../../utils/config.js';
import { reportHealth } from '../../reporters/consoleReporter.js';
import { reportHealthJson } from '../../reporters/jsonReporter.js';
import { reportHealthMarkdown } from '../../reporters/markdownReporter.js';
import { reportHealthSarif } from '../../reporters/sarifReporter.js';

export function registerDoctor(): void {
  program
    .command('doctor')
    .description('Evaluate project health and detect issues')
    .option('--changed-only', 'only report issues on files changed vs base ref')
    .option('--base-ref <ref>', 'git base ref for --changed-only (default: origin/main)')
    .option('--package <name>', 'monorepo: scope issues to a single workspace package')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const config = await loadProjectConfig();
      const spinner = format === 'console' ? ora('Running health checks...').start() : null;

      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        let issues = await collectIssues(rootPath, scan.files);
        issues = applyConfigToIssues(issues, config);
        if (cmdOpts.changedOnly) {
          issues = await filterIssuesByChangedFiles(issues, rootPath, cmdOpts.baseRef ?? config.baseRef);
        }
        if (cmdOpts.package) {
          const ws = await detectWorkspaces(rootPath);
          const allowed = new Set(filterFilesByPackage(ws, cmdOpts.package, scan.files.map((f) => f.relativePath)));
          issues = issues.filter((i) => (i.locations ?? []).some((l) => l.file && allowed.has(l.file)));
        }

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportHealthJson(issues);
            break;
          case 'markdown':
            reportHealthMarkdown(issues);
            break;
          case 'sarif':
            reportHealthSarif(issues, pkg.version);
            break;
          default:
            reportHealth(issues, scan.scanDurationMs);
        }
      } catch (error) {
        if (spinner) spinner.fail('Health check failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
