import ora from 'ora';
import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { computeReview } from '../../core/review.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import { reportReview } from '../../reporters/consoleReporter.js';
import { reportReviewJson } from '../../reporters/jsonReporter.js';
import { reportReviewMarkdown } from '../../reporters/markdownReporter.js';

export function registerReview(): void {
  program
    .command('review')
    .description('One-shot PR review: structural diff + risk + cycles + risky functions + dep changes + verdict')
    .option('--base <ref>', 'base ref (default: origin/main, falling back to main/master/HEAD~1)')
    .option('--head <ref>', 'head ref (default: HEAD)')
    .option('--package <name>', 'monorepo: scope review to a single workspace package')
    .action(async (cmdOpts: { base?: string; head?: string; package?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Reviewing PR...').start() : null;

      try {
        const report = await computeReview(rootPath, { base: cmdOpts.base, head: cmdOpts.head });

        if (cmdOpts.package && report.available) {
          const ws = await detectWorkspaces(rootPath);
          const target = cmdOpts.package;
          const allChangedPaths = [
            ...report.prDiff.filesAdded,
            ...report.prDiff.filesRemoved,
            ...report.prDiff.filesModified.map((f) => f.relativePath),
          ];
          const allowed = new Set(filterFilesByPackage(ws, target, allChangedPaths));
          report.prDiff.filesAdded = report.prDiff.filesAdded.filter((f) => allowed.has(f));
          report.prDiff.filesRemoved = report.prDiff.filesRemoved.filter((f) => allowed.has(f));
          report.prDiff.filesModified = report.prDiff.filesModified.filter((f) => allowed.has(f.relativePath));
          report.prDiff.totalFilesChanged =
            report.prDiff.filesAdded.length +
            report.prDiff.filesRemoved.length +
            report.prDiff.filesModified.length;
          report.changedFiles = report.changedFiles.filter((f) => allowed.has(f.relativePath));
          report.newCycles = report.newCycles.filter((c) => c.files.some((f) => allowed.has(f)));
          report.riskyFunctions = report.riskyFunctions.filter((f) => allowed.has(f.file));
          report.dependencyChanges = report.dependencyChanges.filter((d) => d.workspace === target);
        }

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportReviewJson(report);
            break;
          case 'markdown':
            reportReviewMarkdown(report);
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
