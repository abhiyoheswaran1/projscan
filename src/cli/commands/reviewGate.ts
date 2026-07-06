import chalk from 'chalk';

import {
  assertFormatSupported,
  getWorktreeTarget,
  loadProjectConfig,
  maybeCompactBanner,
  program,
  registerWorktreeTargetOptions,
  setupLogLevel,
} from '../_shared.js';
import { computeReviewGate } from '../../core/reviewGate.js';
import type { BootstrapContractResult } from '../../types/proofBroker.js';
import type { ReviewGateReport } from '../../types/reviewGate.js';

export function registerReviewGate(): void {
  registerWorktreeTargetOptions(
    program
      .command('review-gate')
    .description('Decide whether a PR is reviewable by turning proof gaps into review debt')
    .option('--intent <text>', 'plain-language change intent to contract before or during work')
    .option('--contract <path>', 'existing Proof Contract JSON path')
    .option('--bootstrap-contract', 'write a new Proof Contract before building the review surface')
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
    .option('--fail-on-needs-proof', 'exit non-zero for any not-ready Review Gate status'),
  )
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('review-gate');

      try {
        if (cmdOpts.bootstrapContract && !cmdOpts.intent?.trim()) {
          throw new Error('review-gate --bootstrap-contract requires --intent');
        }
        if (cmdOpts.bootstrapContract && cmdOpts.contract) {
          throw new Error(
            'review-gate --bootstrap-contract cannot be used with --contract; use --save-contract to choose the output path',
          );
        }
        const worktree = await resolveTarget(cmdOpts);
        const config = await loadProjectConfig(worktree.effectiveWorktreePath);
        const report = await computeReviewGate(worktree.effectiveWorktreePath, {
          intent: cmdOpts.intent,
          contractPath: cmdOpts.contract,
          bootstrapContract: cmdOpts.bootstrapContract,
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
  console.log(chalk.bold('Target'));
  printTarget(report);
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
  printRecontract(report);
  if (report.bootstrap) {
    console.log('');
    console.log(chalk.bold('Bootstrap'));
    printBootstrap(report.bootstrap);
  }
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

function printTarget(report: ReviewGateReport): void {
  console.log(`- worktree: ${report.target.effectiveWorktreePath}`);
  if (report.target.effectiveWorktreeBranch) {
    console.log(`- branch: ${report.target.effectiveWorktreeBranch}`);
  }
  if (report.target.effectiveWorktreeHead) {
    console.log(`- head: ${report.target.effectiveWorktreeHead}`);
  }
  if (report.target.gitCommonRoot) {
    console.log(`- common root: ${report.target.gitCommonRoot}`);
  }
}

function printRecontract(report: ReviewGateReport): void {
  console.log(`- required: ${report.recontract.required ? 'yes' : 'no'}`);
  console.log(`- reason: ${report.recontract.reason}`);
  console.log(`- worktree: ${report.recontract.target.effectiveWorktreePath}`);
  if (report.recontract.target.effectiveWorktreeBranch) {
    console.log(`- branch: ${report.recontract.target.effectiveWorktreeBranch}`);
  }
  if (report.recontract.target.effectiveWorktreeHead) {
    console.log(`- head: ${report.recontract.target.effectiveWorktreeHead}`);
  }
  console.log(`- recommended intent: ${report.recontract.recommendedIntent ?? '<change intent>'}`);
  console.log(`- recommended contract path: ${report.recontract.recommendedContractPath}`);
  console.log('- drift files:');
  printList(report.recontract.driftFiles, 'No drift files');
  console.log('- follow-up commands:');
  printList(report.recontract.followUpCommands.slice(0, 10), 'No follow-up commands');
}

function printBootstrap(bootstrap: BootstrapContractResult): void {
  console.log(`- attempted: ${bootstrap.attempted ? 'yes' : 'no'}`);
  console.log(`- wrote contract: ${bootstrap.wroteContract ? 'yes' : 'no'}`);
  console.log(`- contract path: ${bootstrap.contractPath ?? 'none'}`);
  console.log(`- intent: ${bootstrap.intent}`);
  console.log('- next commands:');
  printList(bootstrap.followUpCommands.slice(0, 10), 'No bootstrap commands');
}

async function resolveTarget(
  cmdOpts: { worktree?: string; root?: string },
): Promise<Awaited<ReturnType<typeof getWorktreeTarget>>> {
  const requestedPath = cmdOpts.worktree ?? cmdOpts.root;
  try {
    return await getWorktreeTarget(requestedPath);
  } catch (err) {
    if (requestedPath) {
      throw new Error(`${requestedPath} is not inside a git worktree.`, { cause: err });
    }
    throw err;
  }
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
