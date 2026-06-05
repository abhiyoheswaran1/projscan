import path from 'node:path';
import chalk from 'chalk';

import { program, getRootPath, setupLogLevel, maybeCompactBanner, assertFormatSupported } from '../_shared.js';
import { computeMergeRisk } from '../../core/mergeRisk.js';

/**
 * `projscan merge-risk` (4.x) — safe integration order + risk hotspots across
 * the repo's in-flight git worktrees. Builds on collision detection.
 */
export function registerMergeRisk(): void {
  program
    .command('merge-risk')
    .description('Safe integration order + conflict hotspots across in-flight worktrees')
    .option('--base-ref <ref>', 'base ref each worktree is diffed against')
    .action(async (cmdOpts: { baseRef?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('merge-risk');
      const rootPath = getRootPath();
      const report = await computeMergeRisk(rootPath, cmdOpts.baseRef ? { baseRef: cmdOpts.baseRef } : {});

      if (format === 'json') {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      const rel = (p: string): string => {
        const r = path.relative(rootPath, p);
        return r === '' ? '.' : r;
      };

      console.log('');
      console.log(chalk.bold('Merge risk'));
      console.log(chalk.dim('────────────────────────────────────────'));

      if (!report.available) {
        console.log(chalk.dim(`  ${report.reason}`));
        return;
      }

      console.log(chalk.bold('  Integration order (merge cleanest first):'));
      report.integrationOrder.forEach((step, i) => {
        const risk =
          step.riskScore === 0
            ? chalk.green('clean')
            : step.riskScore <= 2
              ? chalk.yellow(`risk ${step.riskScore}`)
              : chalk.red(`risk ${step.riskScore}`);
        console.log(
          `    ${i + 1}. ${chalk.bold(step.branch ?? rel(step.worktree))} ${chalk.dim(
            `(${step.changedFileCount} changed, ${step.collisionCount} collision(s))`,
          )} ${risk}`,
        );
      });

      if (report.hotFiles.length > 0) {
        console.log('');
        console.log(chalk.bold('  Conflict hotspots (changed by multiple worktrees):'));
        for (const h of report.hotFiles) {
          const tag = h.severity === 'high' ? chalk.red('●') : chalk.yellow('●');
          console.log(`    ${tag} ${h.file} ${chalk.dim(`(${h.worktrees.length} worktrees)`)}`);
        }
      } else {
        console.log('');
        console.log(`  ${chalk.green('✓')} No files changed by multiple worktrees.`);
      }
    });
}
