import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeDogfoodReport } from '../../core/dogfood.js';
import type { DogfoodReport, DogfoodRepoResult } from '../../types.js';

export function registerDogfood(): void {
  program
    .command('dogfood')
    .description('Run projscan adoption proof across real repos and report usefulness gaps')
    .option('--repo <path>', 'repo path to evaluate, repeatable (default: current repo)', collectRepo, [])
    .option('--target-repos <count>', 'target number of repos before adoption is considered proven', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('dogfood');
      try {
        const report = await computeDogfoodReport(getRootPath(), {
          repos: cmdOpts.repo,
          targetRepoCount: cmdOpts.targetRepos,
        });
        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printDogfood(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function collectRepo(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}

function printDogfood(report: DogfoodReport): void {
  const color = report.totals.failingRepos > 0 ? chalk.red : report.totals.warningRepos > 0 ? chalk.yellow : chalk.green;
  console.log(color('Dogfood: ' + report.totals.reposEvaluated + ' repo(s)'));
  console.log(report.summary);
  console.log('Target repos: ' + report.targetRepoCount);
  console.log('');
  for (const repo of report.repos) printRepo(repo);
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const action of report.suggestedNextActions) {
    if (action.command) console.log('- ' + action.command);
  }
}

function printRepo(repo: DogfoodRepoResult): void {
  console.log('- [' + repo.status + '] ' + repo.name + ' health=' + repo.healthScore + ' prComment=' + repo.prCommentReady + ' repeatUse=' + repo.repeatUseReady);
  for (const gap of repo.gaps.slice(0, 3)) console.log('  gap: ' + gap);
  console.log('  ask: ' + repo.feedbackQuestions[0]);
}
