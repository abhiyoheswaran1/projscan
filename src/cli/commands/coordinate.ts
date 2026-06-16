import chalk from 'chalk';

import {
  program,
  getRootPath,
  setupLogLevel,
  maybeCompactBanner,
  assertFormatSupported,
} from '../_shared.js';
import {
  computeCoordination,
  coordinationSignature,
  type CoordinationReadiness,
  type CoordinationSummary,
} from '../../core/coordination.js';

const VERDICT_COLOR: Record<CoordinationReadiness, (s: string) => string> = {
  clear: chalk.green,
  caution: chalk.yellow,
  conflicted: chalk.red,
};

const WATCH_DEFAULT_SECONDS = 5;
const WATCH_MIN_SECONDS = 2;
const WATCH_MAX_SECONDS = 600;

/**
 * `projscan coordinate` (4.x) — one-call swarm coordination read across
 * in-flight worktrees: collisions + claims + merge-risk folded into a readiness
 * verdict. `--watch` re-evaluates on an interval and re-emits only when the
 * coordination state changes (polling, since the state spans all worktrees).
 */
export function registerCoordinate(): void {
  program
    .command('coordinate')
    .description('One-call swarm coordination read (collisions + claims + merge-risk)')
    .option('--base-ref <ref>', 'base ref each worktree is diffed against')
    .option('--watch', 're-evaluate on an interval; re-emit only when coordination state changes')
    .option('--interval <seconds>', `poll interval for --watch (default ${WATCH_DEFAULT_SECONDS})`)
    .action(async (cmdOpts: { baseRef?: string; watch?: boolean; interval?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('coordinate');
      const rootPath = getRootPath();
      const detectOptions = cmdOpts.baseRef ? { baseRef: cmdOpts.baseRef } : {};

      if (!cmdOpts.watch) {
        render(await computeCoordination(rootPath, detectOptions), format, false);
        return;
      }

      const intervalMs = resolveIntervalMs(cmdOpts.interval, format);
      if (format === 'console') {
        console.log(
          chalk.dim(`Watching swarm coordination (every ${intervalMs / 1000}s; Ctrl+C to stop)…`),
        );
      }
      let lastSignature = '';
      const tick = async (): Promise<void> => {
        try {
          const report = await computeCoordination(rootPath, detectOptions);
          const signature = coordinationSignature(report);
          if (signature !== lastSignature) {
            lastSignature = signature;
            render(report, format, true);
          }
        } catch (err) {
          // Keep watching across transient errors (e.g. mid-rebase git state).
          process.stderr.write(
            `[projscan] coordinate watch tick failed: ${err instanceof Error ? err.message : String(err)}\n`,
          );
        }
      };
      await tick();
      const timer = setInterval(() => void tick(), intervalMs);
      const stop = (): void => {
        clearInterval(timer);
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    });
}

function resolveIntervalMs(raw: string | undefined, format: string): number {
  if (raw === undefined) return WATCH_DEFAULT_SECONDS * 1000;
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds < WATCH_MIN_SECONDS || seconds > WATCH_MAX_SECONDS) {
    const message = `--interval must be ${WATCH_MIN_SECONDS}–${WATCH_MAX_SECONDS} seconds.`;
    if (format === 'json') console.log(JSON.stringify({ ok: false, error: message }, null, 2));
    else console.error(chalk.red(message));
    process.exit(1);
  }
  return seconds * 1000;
}

function render(report: CoordinationSummary, format: string, watch: boolean): void {
  if (format === 'json') {
    // NDJSON in watch mode (one object per change), pretty once otherwise.
    console.log(watch ? JSON.stringify(report) : JSON.stringify(report, null, 2));
    return;
  }
  console.log('');
  const heading = watch
    ? `Swarm coordination · ${new Date().toLocaleTimeString()}`
    : 'Swarm coordination';
  console.log(chalk.bold(heading));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (!report.available) {
    console.log(chalk.dim(`  ${report.reason}`));
    printEvidence(report);
    return;
  }
  console.log(`  Readiness: ${VERDICT_COLOR[report.readiness](report.readiness.toUpperCase())}`);
  console.log('');
  for (const line of report.summary) {
    console.log(`  • ${line}`);
  }
  printEvidence(report);
}

function printEvidence(report: CoordinationSummary): void {
  const evidence = report.evidence;
  if (!evidence) return;
  console.log('');
  console.log(chalk.bold('Evidence'));
  console.log(`  ${evidence.localOnly ? 'local-only' : 'external'}: ${evidence.command}`);
  console.log(`  Worktrees: ${evidence.worktreeCount}`);
  if (evidence.currentWorktree) {
    const branch = evidence.currentWorktree.branch ?? 'detached';
    console.log(
      `  Current: ${evidence.currentWorktree.path} (${branch}, ${evidence.currentWorktree.changedFileCount} changed)`,
    );
  }
  console.log('  Signals:');
  for (const signal of evidence.activeSignals) {
    console.log(`  - ${signal.commandPath}: ${signal.source}`);
  }
  console.log('  Validate:');
  for (const step of evidence.validationWorkflow) {
    console.log(`  - ${step.command}`);
  }
}
