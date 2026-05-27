import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeStartReport } from '../../core/start.js';
import { isWorkplanMode } from '../../core/workplan.js';
import type { StartReport, StartRisk, WorkplanMode } from '../../types.js';

export function registerStart(): void {
  program
    .command('start')
    .description('Orient an engineer or agent with the next best workflow for this repo')
    .option('--mode <mode>', 'before_edit, before_commit, before_merge, refactor, release, bug_hunt, or hardening', 'before_edit')
    .option('--max-tasks <count>', 'maximum workplan tasks to inspect', parsePositiveInt)
    .option('--max-risks <count>', 'maximum start risks to return', parsePositiveInt)
    .option('--include-handoff', 'include a compact handoff payload')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('start');
      const mode = parseMode(cmdOpts.mode);

      try {
        const report = await computeStartReport(getRootPath(), {
          mode,
          maxTasks: cmdOpts.maxTasks,
          maxRisks: cmdOpts.maxRisks,
          includeHandoff: cmdOpts.includeHandoff === true,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printStart(report);
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

function printStart(report: StartReport): void {
  console.log(chalk.bold(`Start: ${report.mode}`));
  console.log(report.summary);
  console.log(`Health: ${report.evidence.healthScore}/100 (${report.evidence.qualityVerdict})`);
  console.log(`Workflow: ${report.recommendedWorkflow.name}`);
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const action of report.nextActions.slice(0, 5)) {
    if (action.command) console.log(`- ${action.command}`);
  }
  console.log('');
  console.log(chalk.bold('Top Risks'));
  for (const risk of report.topRisks.slice(0, 5)) printRisk(risk);
  if (report.adoptionGaps.length > 0) {
    console.log('');
    console.log(chalk.bold('Adoption Gaps'));
    for (const gap of report.adoptionGaps.slice(0, 5)) {
      console.log(`- [${gap.status}] ${gap.title}: ${gap.summary}${gap.command ? ` (${gap.command})` : ''}`);
    }
  }
}

function printRisk(risk: StartRisk): void {
  const files = risk.files.length > 0 ? ` (${risk.files.join(', ')})` : '';
  console.log(`- [${risk.priority}] ${risk.title}${files}`);
  console.log(`  ${risk.command}`);
}
