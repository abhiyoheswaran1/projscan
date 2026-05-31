import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { readFeedbackFile } from '../../core/feedback.js';
import { computeTrialReport } from '../../core/trial.js';
import type { TrialReport } from '../../types.js';

export function registerTrial(): void {
  program
    .command('trial')
    .description('Run the end-to-end local adoption trial report for a team or product')
    .option('--repo <path>', 'repo path to evaluate, repeatable (default: current repo)', collectRepo, [])
    .option('--target-repos <count>', 'target number of repos before adoption is considered proven', parsePositiveInt)
    .option('--feedback <path>', 'JSON feedback artifact from projscan feedback')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('trial');
      try {
        const feedback = cmdOpts.feedback ? await readFeedbackFile(cmdOpts.feedback) : undefined;
        const report = await computeTrialReport(getRootPath(), {
          repos: cmdOpts.repo,
          targetRepoCount: cmdOpts.targetRepos,
          feedback,
          feedbackPath: cmdOpts.feedback,
        });
        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printTrial(report);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

function printTrial(report: TrialReport): void {
  console.log('');
  console.log(chalk.bold('projscan trial'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log('  verdict:     ' + colorVerdict(report.verdict)(report.verdict));
  console.log('  summary:     ' + report.summary);
  console.log('  activation:  ' + report.activation.status + ' (health ' + report.activation.healthScore + ', MCP ' + bool(report.activation.mcpReady) + ')');
  console.log('  repos:       ' + report.dogfood.totals.reposEvaluated + '/' + report.dogfood.targetRepoCount);
  console.log('  feedback:    ' + (report.feedback ? report.feedback.responses + ' response(s)' : 'not captured'));
  console.log('  market:      ' + report.dogfood.marketValidation.status);
  console.log('  repeat PRs:  ' + report.dogfood.marketValidation.repeatUse.distinctPrs + ' PR(s), ' + report.dogfood.marketValidation.repeatUse.repeatedRepos + ' repeated repo(s)');
  console.log('  value:       avg ' + report.dogfood.marketValidation.value.averageMinutesSaved + ' min, ' + report.dogfood.marketValidation.value.preventedBadEdits + ' risky edit(s) prevented');
  if (report.decision.reasons.length > 0) {
    console.log('');
    console.log(chalk.bold('Decision reasons'));
    for (const reason of report.decision.reasons) console.log('  - ' + reason);
  }
  console.log('');
  console.log(chalk.bold('Next commands'));
  for (const action of report.nextCommands) {
    console.log('  - ' + action.label + ': ' + chalk.cyan(action.command ?? action.tool ?? ''));
  }
}

function collectRepo(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error('Expected a positive integer, got ' + value);
  return parsed;
}

function colorVerdict(verdict: TrialReport['verdict']): (text: string) => string {
  if (verdict === 'adopt') return chalk.green;
  if (verdict === 'setup') return chalk.red;
  if (verdict === 'tune') return chalk.yellow;
  return chalk.cyan;
}

function bool(value: boolean): string {
  return value ? 'ready' : 'not ready';
}
