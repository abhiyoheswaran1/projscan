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
import { computeProofBroker } from '../../core/proofBroker.js';
import type { BootstrapContractResult, ProofBrokerReport } from '../../types/proofBroker.js';

export function registerProofBroker(): void {
  registerWorktreeTargetOptions(
    program
      .command('proof-broker')
    .description('Broker required proof and print a PR Passport for reviewer handoff')
    .option('--intent <text>', 'plain-language change intent to contract before or during work')
    .option('--contract <path>', 'existing Proof Contract JSON path')
    .option('--bootstrap-contract', 'write a new Proof Contract before building the review surface')
    .option('--save-contract <path>', 'write the generated Proof Contract JSON when --intent is supplied')
    .option('--output-passport <path>', 'write Agent Change Passport JSON to .projscan/passport.json')
    .option('--max-files <count>', 'maximum likely touched files to include in a generated contract', parsePositiveInt)
    .option('--feedback <path>', 'local projscan feedback artifact to apply as trust memory')
    .option('--base-ref <ref>', 'base ref for changed-file detection')
    .option('--ledger <path>', 'proof ledger JSONL path')
    .option('--pr-comment', 'print PR Passport Markdown for a pull request comment'),
  )
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('proof-broker');

      try {
        if (cmdOpts.bootstrapContract && !cmdOpts.intent?.trim()) {
          throw new Error('proof-broker --bootstrap-contract requires --intent');
        }
        if (cmdOpts.bootstrapContract && cmdOpts.contract) {
          throw new Error(
            'proof-broker --bootstrap-contract cannot be used with --contract; use --save-contract to choose the output path',
          );
        }
        const worktree = await resolveTarget(cmdOpts);
        const config = await loadProjectConfig(worktree.effectiveWorktreePath);
        const report = await computeProofBroker(worktree.effectiveWorktreePath, {
          intent: cmdOpts.intent,
          contractPath: cmdOpts.contract,
          bootstrapContract: cmdOpts.bootstrapContract,
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
  console.log(chalk.bold('Target'));
  printTarget(report);
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

function printTarget(report: ProofBrokerReport): void {
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

function printRecontract(report: ProofBrokerReport): void {
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

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
