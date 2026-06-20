import fs from 'node:fs/promises';
import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeDogfoodReport } from '../../core/dogfood.js';
import type {
  DogfoodFeedbackInput,
  DogfoodFeedbackResponse,
  DogfoodReport,
  DogfoodRepoResult,
} from '../../types/dogfood.js';

export function registerDogfood(): void {
  program
    .command('dogfood')
    .description('Run projscan adoption proof across real repos and report usefulness gaps')
    .option(
      '--repo <path>',
      'repo path to evaluate, repeatable (default: current repo)',
      collectRepo,
      [],
    )
    .option(
      '--target-repos <count>',
      'target number of repos before adoption is considered proven',
      parsePositiveInt,
    )
    .option(
      '--discover <path>',
      'workspace root to discover local package repos from, repeatable',
      collectRepo,
      [],
    )
    .option('--feedback <path>', 'JSON file with first-PR reviewer feedback responses')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('dogfood');
      try {
        const report = await computeDogfoodReport(getRootPath(), {
          repos: cmdOpts.repo,
          discoverRoots: cmdOpts.discover,
          targetRepoCount: cmdOpts.targetRepos,
          feedback: cmdOpts.feedback ? await readFeedback(cmdOpts.feedback) : undefined,
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

async function readFeedback(filePath: string): Promise<DogfoodFeedbackInput> {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as { responses?: DogfoodFeedbackResponse[] };
  if (!Array.isArray(parsed.responses)) {
    throw new Error('feedback file must contain a responses array');
  }
  return { responses: parsed.responses };
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
  const color =
    report.totals.failingRepos > 0
      ? chalk.red
      : report.totals.warningRepos > 0
        ? chalk.yellow
        : chalk.green;
  console.log(color('Dogfood: ' + report.totals.reposEvaluated + ' repo(s)'));
  console.log(report.summary);
  console.log('Target repos: ' + report.targetRepoCount);
  console.log(
    'Market validation: ' +
      report.marketValidation.status +
      ' - ' +
      report.marketValidation.summary,
  );
  console.log(
    'Minutes saved: ' +
      report.marketValidation.feedback.minutesSaved.total +
      '; prevented risky edits: ' +
      report.marketValidation.feedback.preventedBadEdits +
      '; false positives: ' +
      report.marketValidation.falsePositive.totalReports,
  );
  console.log('');
  for (const repo of report.repos) printRepo(repo);
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const action of report.suggestedNextActions) {
    if (action.command) console.log('- ' + action.command);
  }
}

function printRepo(repo: DogfoodRepoResult): void {
  console.log(
    '- [' +
      repo.status +
      '] ' +
      repo.name +
      ' health=' +
      repo.healthScore +
      ' prComment=' +
      repo.prCommentReady +
      ' repeatUse=' +
      repo.repeatUseReady,
  );
  for (const gap of repo.gaps.slice(0, 3)) console.log('  gap: ' + gap);
  console.log('  ask: ' + repo.feedbackQuestions[0]);
  if (repo.validation.feedbackResponses > 0) {
    console.log(
      '  validation: ' +
        repo.validation.minutesSaved +
        ' min saved, ' +
        repo.validation.preventedBadEdits +
        ' risky edit(s) prevented',
    );
  }
}
