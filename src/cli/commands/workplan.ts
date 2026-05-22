import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeWorkplan, isWorkplanMode } from '../../core/workplan.js';
import type { WorkplanMode, WorkplanReport, WorkplanTask } from '../../types.js';

export function registerWorkplan(): void {
  program
    .command('workplan')
    .description('Compose repo signals into an ordered agent execution plan')
    .option('--mode <mode>', 'before_edit, before_commit, before_merge, refactor, release, bug_hunt, or hardening', 'before_edit')
    .option('--base-ref <ref>', 'git base ref for commit/merge/release checks')
    .option('--head-ref <ref>', 'git head ref for merge/release checks')
    .option('--max-changed-files <count>', 'caution threshold for changed files', parsePositiveInt)
    .option('--max-tasks <count>', 'maximum number of tasks to return', parsePositiveInt)
    .option('--enable-plugins', 'enable local analyzer plugins for this run')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('workplan');
      const mode = parseMode(cmdOpts.mode);

      try {
        const report = await computeWorkplan(getRootPath(), {
          mode,
          baseRef: cmdOpts.baseRef,
          headRef: cmdOpts.headRef,
          maxChangedFiles: cmdOpts.maxChangedFiles,
          maxTasks: cmdOpts.maxTasks,
          enablePlugins: cmdOpts.enablePlugins === true,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printWorkplan(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  program
    .command('handoff')
    .description('Print a concise agent handoff from the current workplan')
    .option('--mode <mode>', 'workplan mode to summarize', 'before_edit')
    .option('--max-tasks <count>', 'maximum number of tasks to include', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('handoff');
      const mode = parseMode(cmdOpts.mode);

      try {
        const report = await computeWorkplan(getRootPath(), {
          mode,
          maxTasks: cmdOpts.maxTasks ?? 5,
        });

        if (format === 'json') {
          console.log(JSON.stringify({ handoff: buildHandoffPayload(report) }, null, 2));
          return;
        }
        printHandoff(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function parseMode(value: unknown): WorkplanMode {
  if (typeof value === 'string' && isWorkplanMode(value)) return value;
  console.error(chalk.red(`Unsupported --mode ${String(value)}.`));
  console.error(chalk.dim('Supported modes: before_edit, before_commit, before_merge, refactor, release, bug_hunt, hardening'));
  process.exit(1);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}

function printWorkplan(report: WorkplanReport): void {
  const color =
    report.verdict === 'block'
      ? chalk.red
      : report.verdict === 'caution'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Workplan: ${report.verdict} (${report.mode})`));
  console.log(report.summary);

  if (report.topRisks.length > 0) {
    console.log('');
    console.log(chalk.bold('Top Risks'));
    for (const risk of report.topRisks.slice(0, 5)) {
      const location = risk.file ? ` (${risk.file})` : '';
      console.log(`- [${risk.priority}] ${risk.message}${location}`);
    }
  }

  console.log('');
  console.log(chalk.bold('Tasks'));
  for (const task of report.tasks) {
    printTask(task);
  }

  console.log('');
  console.log(chalk.bold('Coordination'));
  console.log(`- ${report.coordination.recommendedNextAgent}`);
  for (const file of report.coordination.touchedFiles.slice(0, 5)) {
    console.log(`- touched: ${file}`);
  }
}

function printTask(task: WorkplanTask): void {
  console.log(`- ${chalk.bold(`[${task.priority}] ${task.title}`)}`);
  console.log(`  ${task.why}`);
  if (task.files.length > 0) console.log(`  files: ${task.files.join(', ')}`);
  console.log(`  verify: ${task.verification.commands.join(' && ')}`);
}

function printHandoff(report: WorkplanReport): void {
  console.log(chalk.bold('Agent Handoff'));
  console.log(report.summary);
  console.log('');
  console.log(chalk.bold('Next'));
  for (const task of report.tasks.slice(0, 5)) {
    console.log(`- ${task.handoffText}`);
  }
  console.log('');
  console.log(chalk.bold('Coordination'));
  console.log(`- ${report.coordination.recommendedNextAgent}`);
}

function buildHandoffPayload(report: WorkplanReport): {
  summary: string;
  verdict: WorkplanReport['verdict'];
  mode: WorkplanMode;
  next: string[];
  coordination: WorkplanReport['coordination'];
} {
  return {
    summary: report.summary,
    verdict: report.verdict,
    mode: report.mode,
    next: report.tasks.slice(0, 5).map((task) => task.handoffText),
    coordination: report.coordination,
  };
}
