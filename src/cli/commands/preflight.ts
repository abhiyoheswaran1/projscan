import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computePreflight } from '../../core/preflight.js';
import type { PreflightMode, PreflightReport } from '../../types.js';

const PREFLIGHT_MODES: readonly PreflightMode[] = [
  'before_edit',
  'before_commit',
  'before_merge',
];

export function registerPreflight(): void {
  program
    .command('preflight')
    .description('Answer whether an agent can safely proceed')
    .option('--mode <mode>', 'before_edit, before_commit, or before_merge', 'before_edit')
    .option('--base-ref <ref>', 'git base ref for commit/merge checks')
    .option('--head-ref <ref>', 'git head ref for merge checks')
    .option('--max-changed-files <count>', 'caution threshold for changed files', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('preflight');
      const mode = parseMode(cmdOpts.mode);

      try {
        const report = await computePreflight(getRootPath(), {
          mode,
          baseRef: cmdOpts.baseRef,
          headRef: cmdOpts.headRef,
          maxChangedFiles: cmdOpts.maxChangedFiles,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printConsoleReport(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function parseMode(value: unknown): PreflightMode {
  if (typeof value === 'string' && (PREFLIGHT_MODES as readonly string[]).includes(value)) {
    return value as PreflightMode;
  }
  console.error(chalk.red(`Unsupported --mode ${String(value)}.`));
  console.error(chalk.dim(`Supported modes: ${PREFLIGHT_MODES.join(', ')}`));
  process.exit(1);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('--max-changed-files must be a positive integer');
  }
  return parsed;
}

function printConsoleReport(report: PreflightReport): void {
  const color =
    report.verdict === 'block'
      ? chalk.red
      : report.verdict === 'caution'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Preflight: ${report.verdict}`));
  console.log(report.summary);

  if (report.reasons.length > 0) {
    console.log('');
    console.log(chalk.bold('Reasons'));
    for (const reason of report.reasons.slice(0, 8)) {
      const location = reason.file ? ` (${reason.file})` : '';
      console.log(`- [${reason.severity}] ${reason.message}${location}`);
    }
  }

  if (report.suggestedNextActions.length > 0) {
    console.log('');
    console.log(chalk.bold('Next'));
    for (const action of report.suggestedNextActions.slice(0, 5)) {
      console.log(`- ${action.command ?? action.tool ?? action.label}`);
    }
  }
}
