import chalk from 'chalk';

import { program, getRootPath, setupLogLevel, maybeCompactBanner, assertFormatSupported } from '../_shared.js';
import { computeCoordination, type CoordinationReadiness } from '../../core/coordination.js';

const VERDICT_COLOR: Record<CoordinationReadiness, (s: string) => string> = {
  clear: chalk.green,
  caution: chalk.yellow,
  conflicted: chalk.red,
};

/**
 * `projscan coordinate` (4.x) — one-call coordination read across in-flight
 * worktrees: collisions + claims + merge-risk folded into a readiness verdict.
 */
export function registerCoordinate(): void {
  program
    .command('coordinate')
    .description('One-call swarm coordination read (collisions + claims + merge-risk)')
    .option('--base-ref <ref>', 'base ref each worktree is diffed against')
    .action(async (cmdOpts: { baseRef?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('coordinate');
      const rootPath = getRootPath();
      const report = await computeCoordination(rootPath, cmdOpts.baseRef ? { baseRef: cmdOpts.baseRef } : {});

      if (format === 'json') {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.bold('Swarm coordination'));
      console.log(chalk.dim('────────────────────────────────────────'));
      if (!report.available) {
        console.log(chalk.dim(`  ${report.reason}`));
        return;
      }
      const color = VERDICT_COLOR[report.readiness];
      console.log(`  Readiness: ${color(report.readiness.toUpperCase())}`);
      console.log('');
      for (const line of report.summary) {
        console.log(`  • ${line}`);
      }
    });
}
