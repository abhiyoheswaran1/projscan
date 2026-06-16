import path from 'node:path';
import chalk from 'chalk';

import {
  program,
  getRootPath,
  setupLogLevel,
  maybeCompactBanner,
  assertFormatSupported,
} from '../_shared.js';
import { detectCollisions } from '../../core/collisionDetector.js';

/**
 * `projscan collisions` (4.x) — surface change collisions across the repo's
 * in-flight git worktrees so parallel agents see overlaps before merge.
 */
export function registerCollision(): void {
  program
    .command('collisions')
    .description('Detect change collisions across in-flight git worktrees (parallel agents)')
    .option('--base-ref <ref>', 'base ref each worktree is diffed against')
    .option('--transitive', 'also report multi-hop dependency overlaps (less precise)')
    .option('--max-distance <n>', 'max import hops for --transitive (default 5)')
    .action(async (cmdOpts: { baseRef?: string; transitive?: boolean; maxDistance?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('collisions');
      const rootPath = getRootPath();
      const maxDistance =
        cmdOpts.maxDistance !== undefined ? Number.parseInt(cmdOpts.maxDistance, 10) : undefined;
      const report = await detectCollisions(rootPath, {
        ...(cmdOpts.baseRef ? { baseRef: cmdOpts.baseRef } : {}),
        ...(cmdOpts.transitive ? { transitive: true } : {}),
        ...(maxDistance !== undefined && Number.isFinite(maxDistance) && maxDistance > 0
          ? { maxDistance }
          : {}),
      });

      if (format === 'json') {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.bold('Worktree collisions'));
      console.log(chalk.dim('────────────────────────────────────────'));

      if (!report.available) {
        console.log(chalk.dim(`  ${report.reason}`));
        return;
      }

      const rel = (p: string): string => {
        const r = path.relative(rootPath, p);
        return r === '' ? '.' : r;
      };

      console.log(
        `  ${report.worktrees.length} worktree(s): ${report.worktrees
          .map(
            (w) =>
              `${chalk.bold(w.branch ?? '(detached)')} ${chalk.dim(`(${w.changedFileCount} changed)`)}`,
          )
          .join(', ')}`,
      );

      if (report.collisions.length === 0) {
        console.log('');
        console.log(`  ${chalk.green('✓')} No collisions across in-flight worktrees.`);
        return;
      }

      const high = report.collisions.filter((c) => c.severity === 'high');
      const medium = report.collisions.filter((c) => c.severity === 'medium');
      console.log('');
      console.log(
        `  ${chalk.red(`${high.length} high`)} · ${chalk.yellow(`${medium.length} medium`)} collision(s)`,
      );
      console.log('');
      for (const c of report.collisions) {
        const tag = c.severity === 'high' ? chalk.red('● same-file') : chalk.yellow('● dependency');
        console.log(`  ${tag}  ${chalk.dim(`[${rel(c.worktreeA)} ↔ ${rel(c.worktreeB)}]`)}`);
        console.log(`      ${c.reason}`);
      }
    });
}
