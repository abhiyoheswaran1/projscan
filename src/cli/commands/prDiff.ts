import ora from 'ora';
import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { computePrDiff } from '../../core/prDiff.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import { reportPrDiff } from '../../reporters/consoleReporter.js';
import { reportPrDiffJson } from '../../reporters/jsonReporter.js';
import { reportPrDiffMarkdown } from '../../reporters/markdownReporter.js';

export function registerPrDiff(): void {
  program
    .command('pr-diff')
    .description('Structural (AST) diff between two refs - what changed in exports, imports, calls, CC, fan-in')
    .option('--base <ref>', 'base ref (default: origin/main, falling back to main/master/HEAD~1)')
    .option('--head <ref>', 'head ref (default: HEAD)')
    .option('--package <name>', 'monorepo: scope diff to a single workspace package')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Computing structural PR diff...').start() : null;

      try {
        const report = await computePrDiff(rootPath, { base: cmdOpts.base, head: cmdOpts.head });
        if (cmdOpts.package) {
          const ws = await detectWorkspaces(rootPath);
          const collected = [
            ...report.filesAdded,
            ...report.filesRemoved,
            ...report.filesModified.map((f) => f.relativePath),
          ];
          const allowed = new Set(filterFilesByPackage(ws, cmdOpts.package, collected));
          report.filesAdded = report.filesAdded.filter((f) => allowed.has(f));
          report.filesRemoved = report.filesRemoved.filter((f) => allowed.has(f));
          report.filesModified = report.filesModified.filter((f) => allowed.has(f.relativePath));
          report.totalFilesChanged =
            report.filesAdded.length + report.filesRemoved.length + report.filesModified.length;
        }
        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportPrDiffJson(report);
            break;
          case 'markdown':
            reportPrDiffMarkdown(report);
            break;
          default:
            reportPrDiff(report);
        }
      } catch (error) {
        if (spinner) spinner.fail('PR diff failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
