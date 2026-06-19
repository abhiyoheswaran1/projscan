import path from 'node:path';

import chalk from 'chalk';

import {
  addFeedbackResponse,
  classifyFeedbackIntake,
  createFeedbackTemplate,
  summarizeFeedbackFile,
} from '../../core/feedback.js';
import { recordFeedbackTelemetry } from '../../core/telemetry.js';
import type { DogfoodFeedbackResponse, FeedbackSummaryReport } from '../../types/dogfood.js';
import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  pkg,
  program,
  setupLogLevel,
} from '../_shared.js';

const DEFAULT_FEEDBACK_FILE = '.projscan-feedback.json';

export function registerFeedback(): void {
  const feedback = program
    .command('feedback')
    .description('Capture reviewer usefulness feedback for dogfood and market validation')
    .action(async () => {
      await runSummary({ file: DEFAULT_FEEDBACK_FILE }, 'feedback');
    });

  feedback
    .command('init')
    .description('Create a reusable .projscan-feedback.json artifact')
    .option('--output <path>', 'feedback file to write', DEFAULT_FEEDBACK_FILE)
    .option('--force', 'overwrite an existing feedback file')
    .action(async (cmdOpts) => {
      await runInit(cmdOpts);
    });

  feedback
    .command('add')
    .description('Append one real PR reviewer response to the feedback artifact')
    .requiredOption('--repo <name>', 'repo name or path the feedback belongs to')
    .requiredOption('--pr <url>', 'PR URL or stable PR id')
    .requiredOption('--reviewer <handle>', 'reviewer handle or role')
    .option('--file <path>', 'feedback file to update', DEFAULT_FEEDBACK_FILE)
    .option('--useful <bool>', 'whether the PR comment was useful')
    .option(
      '--minutes-saved <count>',
      'measured minutes saved by the PR comment',
      parseNonNegativeNumber,
    )
    .option(
      '--prevented-bad-edit',
      'record that projscan prevented a risky edit or missed review step',
    )
    .option('--owner-routing-clear <bool>', 'whether owner routing was clear')
    .option('--next-command-clear <bool>', 'whether the next command was clear')
    .option(
      '--false-positive-rule <rule>',
      'false-positive/noisy rule id, repeatable',
      collectString,
      [],
    )
    .option(
      '--missing-signal <signal>',
      'missing signal reviewers expected, repeatable',
      collectString,
      [],
    )
    .option('--noisy-finding <finding>', 'noisy finding description, repeatable', collectString, [])
    .option('--note <text>', 'optional reviewer note')
    .action(async (cmdOpts) => {
      await runAdd(cmdOpts);
    });

  feedback
    .command('intake')
    .description('Classify pasted agent or reviewer feedback into an actionable fix candidate')
    .requiredOption('--text <text>', 'raw feedback text to classify')
    .option('--file <path>', 'feedback file to update when --append is set', DEFAULT_FEEDBACK_FILE)
    .option('--append', 'append the classified signal to the feedback artifact')
    .action(async (cmdOpts) => {
      await runIntake(cmdOpts);
    });

  feedback
    .command('summary')
    .description('Summarize reviewer feedback evidence before dogfood')
    .option('--file <path>', 'feedback file to read', DEFAULT_FEEDBACK_FILE)
    .action(async (cmdOpts) => {
      await runSummary(cmdOpts, 'feedback summary');
    });
}

async function runIntake(cmdOpts: Record<string, unknown>): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('feedback intake');
  try {
    const report = classifyFeedbackIntake(requiredString(cmdOpts.text, '--text'));
    if (cmdOpts.append === true) {
      const filePath = resolveFromRoot(asString(cmdOpts.file) ?? DEFAULT_FEEDBACK_FILE);
      const artifact = await addFeedbackResponse(filePath, report.feedbackResponse);
      report.appended = {
        path: filePath,
        responses: artifact.responses.length,
      };
    }
    if (format === 'json') {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    printIntake(report);
  } catch (error) {
    printError(error);
  }
}

async function runInit(cmdOpts: { output: string; force?: boolean }): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('feedback init');
  try {
    const result = await createFeedbackTemplate(resolveFromRoot(cmdOpts.output), {
      force: cmdOpts.force === true,
    });
    if (format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(chalk.green('Created feedback artifact: ') + result.path);
    console.log(
      chalk.dim(
        'Next: projscan feedback add --file ' +
          result.path +
          ' --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10',
      ),
    );
  } catch (error) {
    printError(error);
  }
}

async function runAdd(cmdOpts: Record<string, unknown>): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('feedback add');
  try {
    const filePath = resolveFromRoot(asString(cmdOpts.file) ?? DEFAULT_FEEDBACK_FILE);
    const response: DogfoodFeedbackResponse = {
      repo: requiredString(cmdOpts.repo, '--repo'),
      pr: requiredString(cmdOpts.pr, '--pr'),
      reviewer: requiredString(cmdOpts.reviewer, '--reviewer'),
      useful: parseOptionalBool(cmdOpts.useful, '--useful'),
      minutesSaved: typeof cmdOpts.minutesSaved === 'number' ? cmdOpts.minutesSaved : undefined,
      preventedBadEdit: cmdOpts.preventedBadEdit === true,
      ownerRoutingClear: parseOptionalBool(cmdOpts.ownerRoutingClear, '--owner-routing-clear'),
      nextCommandClear: parseOptionalBool(cmdOpts.nextCommandClear, '--next-command-clear'),
      falsePositiveRules: asStringArray(cmdOpts.falsePositiveRule),
      missingSignals: asStringArray(cmdOpts.missingSignal),
      noisyFindings: asStringArray(cmdOpts.noisyFinding),
      note: asString(cmdOpts.note),
    };
    const artifact = await addFeedbackResponse(filePath, response);
    await recordFeedbackTelemetry(response, {
      rootPath: getRootPath(),
      version: pkg.version,
    }).catch(() => undefined);
    if (format === 'json') {
      console.log(JSON.stringify(artifact, null, 2));
      return;
    }
    console.log(
      chalk.green('Recorded feedback response ') + chalk.bold(String(artifact.responses.length)),
    );
    console.log(chalk.dim('Next: projscan feedback summary --file ' + filePath + ' --format json'));
  } catch (error) {
    printError(error);
  }
}

async function runSummary(
  cmdOpts: { file?: string },
  commandName: 'feedback' | 'feedback summary',
): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported(commandName);
  try {
    const filePath = resolveFromRoot(cmdOpts.file ?? DEFAULT_FEEDBACK_FILE);
    const report = await summarizeFeedbackFile(filePath);
    if (format === 'json') {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    printSummary(report);
  } catch (error) {
    printError(error);
  }
}

function printSummary(report: FeedbackSummaryReport): void {
  console.log('');
  console.log(chalk.bold('Reviewer Feedback'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log('  responses:       ' + report.responses);
  console.log('  useful:          ' + report.usefulResponses);
  console.log('  repos / PRs:     ' + report.distinctRepos + ' / ' + report.distinctPrs);
  console.log(
    '  repeated repos:  ' +
      report.repeatUse.repeatedRepos +
      ' ' +
      (report.repeatUse.ready ? chalk.green('(ready)') : chalk.yellow('(needs repeat PRs)')),
  );
  console.log(
    '  minutes saved:   ' +
      report.minutesSaved.total +
      ' total, ' +
      report.minutesSaved.average +
      ' avg',
  );
  console.log('  bad edits saved: ' + report.preventedBadEdits);
  console.log('  false positives: ' + report.falsePositive.totalReports);
  console.log('');
  console.log(chalk.bold('Next command'));
  console.log('  ' + chalk.cyan(report.nextDogfoodCommand));
}

function printIntake(report: ReturnType<typeof classifyFeedbackIntake>): void {
  console.log('');
  console.log(chalk.bold('Feedback Intake'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log('  category:   ' + report.category);
  console.log('  confidence: ' + report.confidence);
  console.log('  task:       ' + report.taskTitle);
  console.log('  verify:     ' + chalk.cyan(report.suggestedCommand));
  console.log('  next:       ' + chalk.cyan(report.nextCommand));
  if (report.appended) {
    console.log(
      '  appended:   ' + report.appended.path + ' (' + report.appended.responses + ' total)',
    );
  }
}

function resolveFromRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(getRootPath(), value);
}

function collectString(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error('Expected a non-negative number, got ' + value);
  return parsed;
}

function parseOptionalBool(value: unknown, optionName: string): boolean | undefined {
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') throw new Error(optionName + ' expects true or false');
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'no', '0'].includes(normalized)) return false;
  throw new Error(optionName + ' expects true or false');
}

function requiredString(value: unknown, optionName: string): string {
  const result = asString(value);
  if (!result) throw new Error(optionName + ' is required');
  return result;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function printError(error: unknown): never {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
