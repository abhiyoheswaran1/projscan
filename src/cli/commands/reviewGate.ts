import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  loadProjectConfig,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeReviewGate } from '../../core/reviewGate.js';
import type { ReviewGateReport } from '../../types/reviewGate.js';

export function registerReviewGate(): void {
  program
    .command('review-gate')
    .description('Decide whether a PR is reviewable by turning proof gaps into review debt')
    .option('--intent <text>', 'plain-language change intent to contract before or during work')
    .option('--contract <path>', 'existing Proof Contract JSON path')
    .option('--save-contract <path>', 'write the generated Proof Contract JSON when --intent is supplied')
    .option('--output-passport <path>', 'write Agent Change Passport JSON to .projscan/passport.json')
    .option('--output <path>', 'write Review Gate JSON to .projscan/review-gate.json')
    .option('--max-files <count>', 'maximum likely touched files to include in a generated contract', parsePositiveInt)
    .option('--feedback <path>', 'local projscan feedback artifact to apply as trust memory')
    .option('--base-ref <ref>', 'base ref for changed-file detection')
    .option('--ledger <path>', 'proof ledger JSONL path')
    .option('--pr-comment', 'print Review Gate Markdown for a pull request comment')
    .option('--ci', 'print a compact CI summary')
    .option('--fail-on-block', 'exit non-zero when review is blocked or the contract drifted')
    .option('--fail-on-needs-proof', 'exit non-zero for any not-ready Review Gate status')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('review-gate');

      try {
        const config = await loadProjectConfig();
        const report = await computeReviewGate(getRootPath(), {
          intent: cmdOpts.intent,
          contractPath: cmdOpts.contract,
          saveContractPath: cmdOpts.saveContract,
          outputPassportPath: cmdOpts.outputPassport,
          outputPath: cmdOpts.output,
          maxFiles: cmdOpts.maxFiles,
          feedbackPath: cmdOpts.feedback,
          baseRef: cmdOpts.baseRef,
          ledgerPath: cmdOpts.ledger,
          proofRecipes: config.proofRecipes,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
        } else if (format === 'markdown' || cmdOpts.prComment) {
          console.log(report.prComment.markdown);
        } else if (cmdOpts.ci) {
          printReviewGateCi(report);
        } else {
          printReviewGateConsole(report);
        }

        if (shouldFailReviewGate(report, cmdOpts)) process.exit(1);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printReviewGateConsole(report: ReviewGateReport): void {
  const color =
    report.status === 'blocked' || report.status === 'drifted'
      ? chalk.red
      : report.status === 'needs-proof'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Projscan Review Gate: ${report.status}`));
  console.log(report.decision.summary);
  console.log('');
  console.log(chalk.bold('Decision'));
  console.log(`- allow review: ${report.decision.allowReview ? 'yes' : 'no'}`);
  console.log(`- reviewer action: ${report.reviewer.action}`);
  console.log(`- reviewer decision: ${report.reviewer.decision}`);
  console.log('');
  console.log(chalk.bold('Proof Debt'));
  printProofDebt(report);
  console.log('');
  console.log(chalk.bold('Required Reviewers'));
  printList(report.requiredReviewers, 'No required reviewers');
  console.log('');
  console.log(chalk.bold('Recontract'));
  console.log(`- required: ${report.recontract.required ? 'yes' : 'no'}`);
  console.log(`- reason: ${report.recontract.reason}`);
  printList(report.recontract.driftFiles, 'No drift files');
  console.log('');
  console.log(chalk.bold('Next Commands'));
  printList(report.nextCommands.slice(0, 10), 'No next commands');
}

function printReviewGateCi(report: ReviewGateReport): void {
  console.log(`Projscan Review Gate: ${report.status}`);
  console.log(`allow review: ${report.decision.allowReview ? 'yes' : 'no'}`);
  console.log(
    `proof debt: total=${report.proofDebt.total} blockers=${report.proofDebt.blockers} warnings=${report.proofDebt.warnings}`,
  );
  console.log(`recontract: ${report.recontract.required ? 'required' : 'not-required'}`);
  console.log(`next: ${report.nextCommands[0] ?? 'none'}`);
}

function printProofDebt(report: ReviewGateReport): void {
  console.log(`- total: ${report.proofDebt.total}`);
  console.log(`- blockers: ${report.proofDebt.blockers}`);
  console.log(`- warnings: ${report.proofDebt.warnings}`);
  if (report.proofDebt.items.length === 0) {
    console.log('- No proof debt');
    return;
  }
  for (const item of report.proofDebt.items.slice(0, 10)) {
    const target = item.command ?? item.file ?? item.requirementId ?? item.kind;
    console.log(`- ${item.severity}: ${item.message}`);
    console.log(`  target: ${target}`);
    console.log(`  next: ${item.nextAction}`);
  }
}

function printList(values: string[], empty: string): void {
  if (values.length === 0) {
    console.log(`- ${empty}`);
    return;
  }
  for (const value of values) console.log(`- ${value}`);
}

function shouldFailReviewGate(
  report: ReviewGateReport,
  options: { failOnBlock?: boolean; failOnNeedsProof?: boolean },
): boolean {
  if (options.failOnNeedsProof) return !report.decision.allowReview;
  if (options.failOnBlock) return report.status === 'blocked' || report.status === 'drifted';
  return false;
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
