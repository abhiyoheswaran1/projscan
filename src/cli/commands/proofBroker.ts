import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  loadProjectConfig,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeProofBroker } from '../../core/proofBroker.js';
import type { ProofBrokerReport } from '../../types/proofBroker.js';

export function registerProofBroker(): void {
  program
    .command('proof-broker')
    .description('Broker required proof and print a PR Passport for reviewer handoff')
    .option('--intent <text>', 'plain-language change intent to contract before or during work')
    .option('--contract <path>', 'existing Proof Contract JSON path')
    .option('--save-contract <path>', 'write the generated Proof Contract JSON when --intent is supplied')
    .option('--output-passport <path>', 'write Agent Change Passport JSON to .projscan/passport.json')
    .option('--max-files <count>', 'maximum likely touched files to include in a generated contract', parsePositiveInt)
    .option('--feedback <path>', 'local projscan feedback artifact to apply as trust memory')
    .option('--base-ref <ref>', 'base ref for changed-file detection')
    .option('--ledger <path>', 'proof ledger JSONL path')
    .option('--pr-comment', 'print PR Passport Markdown for a pull request comment')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('proof-broker');

      try {
        const config = await loadProjectConfig();
        const report = await computeProofBroker(getRootPath(), {
          intent: cmdOpts.intent,
          contractPath: cmdOpts.contract,
          saveContractPath: cmdOpts.saveContract,
          outputPassportPath: cmdOpts.outputPassport,
          maxFiles: cmdOpts.maxFiles,
          feedbackPath: cmdOpts.feedback,
          baseRef: cmdOpts.baseRef,
          ledgerPath: cmdOpts.ledger,
          proofRecipes: config.proofRecipes,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        if (format === 'markdown' || cmdOpts.prComment) {
          console.log(report.prPassport.markdown);
          return;
        }
        printProofBrokerConsole(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printProofBrokerConsole(report: ProofBrokerReport): void {
  const color =
    report.status === 'blocked' || report.status === 'drifted'
      ? chalk.red
      : report.status === 'needs-proof'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Projscan Proof Broker: ${report.status}`));
  console.log(report.summary);
  console.log('');
  console.log(chalk.bold('Reviewer'));
  console.log(`- action: ${report.reviewer.action}`);
  console.log(`- decision: ${report.reviewer.decision}`);
  console.log(`- ${report.reviewer.summary}`);
  console.log('');
  console.log(chalk.bold('Scope'));
  console.log(`- status: ${report.scope.status}`);
  console.log(`- changed files: ${report.scope.changedFiles.length}`);
  console.log(`- risky changed files: ${report.scope.riskyChangedFiles.length}`);
  console.log('');
  console.log(chalk.bold('Required Proof'));
  printRequiredProof(report);
  console.log('');
  console.log(chalk.bold('Required Reviewers'));
  printList(report.requiredReviewers, 'No required reviewers');
  console.log('');
  console.log(chalk.bold('Gaps'));
  printGaps(report);
  console.log('');
  console.log(chalk.bold('Next Commands'));
  printList(report.nextCommands.slice(0, 10), 'No next commands');
}

function printRequiredProof(report: ProofBrokerReport): void {
  if (report.requiredProof.length === 0) {
    console.log('- No required proof rows');
    return;
  }
  for (const row of report.requiredProof.slice(0, 10)) {
    console.log(`- ${row.id}: ${row.status} (${row.surface})`);
    for (const command of row.requiredCommands.slice(0, 4)) console.log(`  - ${command}`);
  }
}

function printGaps(report: ProofBrokerReport): void {
  if (report.gaps.length === 0) {
    console.log('- No proof gaps');
    return;
  }
  for (const gap of report.gaps.slice(0, 10)) {
    console.log(`- ${gap.severity}: ${gap.message}`);
  }
}

function printList(values: string[], empty: string): void {
  if (values.length === 0) {
    console.log(`- ${empty}`);
    return;
  }
  for (const value of values) console.log(`- ${value}`);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
