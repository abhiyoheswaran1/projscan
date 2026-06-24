import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeProve } from '../../core/prove.js';
import type { ProveContract, ProveReceipt, ProveReport } from '../../types/prove.js';

export function registerProve(): void {
  program
    .command('prove')
    .description('Create or validate an executable Proof Contract for a change')
    .option('--intent <text>', 'plain-language change intent to constrain before editing')
    .option('--changed', 'validate the current working tree against a Proof Contract')
    .option('--contract <path>', 'Proof Contract JSON path for --changed')
    .option('--save-contract <path>', 'write the generated Proof Contract JSON in --intent mode')
    .option('--max-files <count>', 'maximum likely touched files to include', parsePositiveInt)
    .option('--feedback <path>', 'local projscan feedback artifact to apply as trust memory')
    .option('--base-ref <ref>', 'base ref for changed-file detection')
    .option('--record-command <command>', 'record a proof command outcome without executing it')
    .option('--exit-code <code>', 'exit code for --record-command', parseExitCode)
    .option('--duration-ms <ms>', 'duration in milliseconds for --record-command', parseDurationMs)
    .option('--summary <text>', 'safe proof output summary for --record-command')
    .option('--log <path>', 'redacted proof log path for --record-command')
    .option('--ledger <path>', 'proof ledger JSONL path')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('prove');

      try {
        const selectedModes = [cmdOpts.intent, cmdOpts.changed, cmdOpts.recordCommand].filter(Boolean);
        if (selectedModes.length > 1) {
          throw new Error('prove accepts either --intent or --changed or --record-command');
        }
        if (selectedModes.length === 0) {
          throw new Error('prove requires --intent "<change>", --changed, or --record-command');
        }
        const report = await computeProve(getRootPath(), {
          intent: cmdOpts.intent,
          changed: Boolean(cmdOpts.changed),
          contractPath: cmdOpts.contract,
          saveContractPath: cmdOpts.saveContract,
          maxFiles: cmdOpts.maxFiles,
          feedbackPath: cmdOpts.feedback,
          baseRef: cmdOpts.baseRef,
          ledgerPath: cmdOpts.ledger,
          recordCommand: cmdOpts.recordCommand,
          exitCode: cmdOpts.exitCode,
          durationMs: cmdOpts.durationMs,
          summary: cmdOpts.summary,
          logPath: cmdOpts.log,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        if (format === 'markdown') {
          console.log(renderProveMarkdown(report));
          return;
        }
        printProveConsole(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printProveConsole(report: ProveReport): void {
  const color =
    report.verdict === 'blocked'
      ? chalk.red
      : report.verdict === 'needs-review'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Projscan Prove: ${report.verdict}`));
  console.log(report.summary);
  console.log('');
  if (report.contract && report.mode === 'intent') {
    printContractConsole(report.contract);
  }
  if (report.ledgerRecord) {
    console.log(chalk.bold('Recorded Proof'));
    console.log(`- ${report.ledgerRecord.status}: ${report.ledgerRecord.command}`);
    console.log(`- ${report.ledgerRecord.changedFiles.length} changed file(s) fingerprinted`);
  }
  if (report.receipt) {
    printReceiptConsole(report.receipt);
  }
}

function printContractConsole(contract: ProveContract): void {
  console.log(chalk.bold('Allowed Files'));
  printList(contract.allowedFiles, 'No concrete allowed files inferred');
  console.log('');
  console.log(chalk.bold('Forbidden Files'));
  printList(contract.forbiddenFiles.slice(0, 8), 'No forbidden files inferred');
  console.log('');
  console.log(chalk.bold('Proof Commands'));
  printList(contract.proofCommands.slice(0, 8), 'No proof commands inferred');
}

function printReceiptConsole(receipt: ProveReceipt): void {
  console.log(chalk.bold('Scope Decision'));
  console.log(`- ${receipt.scope.status}`);
  console.log('');
  console.log(chalk.bold('Changed Files'));
  printList(receipt.scope.changedFiles, 'No changed files detected');
  console.log('');
  console.log(chalk.bold('Allowed production'));
  printList(receipt.scope.allowedProduction, 'No allowed production files touched');
  console.log('');
  console.log(chalk.bold('Expected tests'));
  printList(receipt.scope.expectedTests, 'No expected tests touched');
  if (receipt.scope.forbiddenTouched.length > 0) {
    console.log('');
    console.log(chalk.bold('Forbidden Touched'));
    printList(receipt.scope.forbiddenTouched, 'No forbidden files touched');
  }
  console.log('');
  console.log(chalk.bold('Proof Commands'));
  printList(receipt.proofStatus.commandsRequired.slice(0, 8), 'No proof commands required');
  console.log('');
  console.log(chalk.bold('Proof Replay'));
  console.log(`- status: ${receipt.proofStatus.status}`);
  console.log(`- reviewer decision: ${receipt.reviewerDecision}`);
}

export function renderProveMarkdown(report: ProveReport): string {
  return report.receipt ? renderReceiptMarkdown(report, report.receipt) : renderContractMarkdown(report);
}

function renderContractMarkdown(report: ProveReport): string {
  const contract = report.contract;
  const lines: string[] = ['# Projscan Proof Contract', ''];
  lines.push(`- **Verdict:** ${report.verdict}`);
  lines.push(`- **Summary:** ${report.summary}`);
  if (!contract) return lines.join('\n');
  lines.push(`- **Intent:** ${contract.intent}`);
  lines.push(`- **Confidence:** ${contract.confidence}`);
  lines.push(`- **Evidence strength:** ${contract.evidenceStrength.level} (${contract.evidenceStrength.score})`);
  lines.push('');
  lines.push('## Allowed Files');
  pushList(lines, contract.allowedFiles, 'No concrete allowed files inferred.');
  lines.push('');
  lines.push('## Forbidden Files');
  pushList(lines, contract.forbiddenFiles, 'No forbidden files inferred.');
  lines.push('');
  lines.push('## Risky Contracts');
  pushList(lines, contract.riskyContracts, 'No public contract inferred.');
  lines.push('');
  lines.push('## Likely Tests');
  pushList(lines, contract.likelyTests, 'Add or identify a regression test first.');
  lines.push('');
  lines.push('## Proof Commands');
  pushCodeList(lines, contract.proofCommands);
  lines.push('');
  lines.push('## Reviewer Guidance');
  lines.push(contract.reviewerGuidance);
  return lines.join('\n');
}

function renderReceiptMarkdown(report: ProveReport, receipt: ProveReceipt): string {
  const lines: string[] = ['# Projscan Proof Receipt', ''];
  lines.push(`- **Verdict:** ${report.verdict}`);
  lines.push(`- **Summary:** ${receipt.summary}`);
  lines.push(`- **Commit readiness:** ${receipt.commitReadiness}`);
  lines.push(`- **Scope:** ${receipt.scope.status}`);
  lines.push(`- **Proof status:** ${receipt.proofStatus.status}`);
  lines.push(`- **Reviewer decision:** ${receipt.reviewerDecision}`);
  lines.push('');
  lines.push('## Scope Decision');
  lines.push(`- **Status:** ${receipt.scope.status}`);
  lines.push(`- **Allowed production:** ${receipt.scope.allowedProduction.length}`);
  lines.push(`- **Expected tests:** ${receipt.scope.expectedTests.length}`);
  lines.push(`- **Unexpected production:** ${receipt.scope.unexpectedProduction.length}`);
  lines.push(`- **Forbidden touched:** ${receipt.scope.forbiddenTouched.length}`);
  lines.push('');
  lines.push('## Changed File Classes');
  lines.push('');
  lines.push('### Allowed production');
  pushList(lines, receipt.scope.allowedProduction, 'No allowed production files touched.');
  lines.push('');
  lines.push('### Expected tests');
  pushList(lines, receipt.scope.expectedTests, 'No expected tests touched.');
  lines.push('');
  lines.push('### Unexpected production');
  pushList(lines, receipt.scope.unexpectedProduction, 'No unexpected production files touched.');
  lines.push('');
  lines.push('### Config and security');
  pushList(
    lines,
    unique([...receipt.scope.configTouched, ...receipt.scope.securitySensitiveTouched]),
    'No config or security-sensitive files touched.',
  );
  lines.push('');
  lines.push('### Documentation and generated artifacts');
  pushList(
    lines,
    unique([...receipt.scope.documentationTouched, ...receipt.scope.generatedTouched]),
    'No documentation or generated artifacts touched.',
  );
  lines.push('');
  lines.push('## Changed Files');
  pushList(lines, receipt.scope.changedFiles, 'No changed files detected.');
  lines.push('');
  lines.push('## Forbidden Touched');
  pushList(lines, receipt.scope.forbiddenTouched, 'No forbidden files touched.');
  lines.push('');
  lines.push('## Outside Allowed Scope');
  pushList(lines, receipt.scope.outsideAllowed, 'No changed files outside allowed scope.');
  lines.push('');
  lines.push('## Proof Commands');
  pushCodeList(lines, receipt.proofStatus.commandsRequired);
  lines.push('');
  lines.push('## Proof Replay');
  lines.push(`- **Proof status:** ${receipt.proofStatus.status}`);
  lines.push(`- **Reviewer decision:** ${receipt.reviewerDecision}`);
  lines.push(`- **Risk delta:** ${receipt.riskDeltaDirection} (${receipt.riskDelta.delta})`);
  lines.push(`- **Commands required:** ${receipt.proofStatus.commandsRequired.length}`);
  lines.push(`- **Commands recorded:** ${receipt.proofStatus.commandsRun.length}`);
  lines.push('');
  lines.push('### Command Evidence');
  pushCommandEvidence(lines, receipt.proofStatus.commandEvidence);
  lines.push('');
  lines.push('### Missing Commands');
  pushCodeList(lines, receipt.proofStatus.missingCommands);
  lines.push('');
  lines.push('### Failed Commands');
  pushCodeList(lines, receipt.proofStatus.failedCommands);
  lines.push('');
  lines.push('### Stale Commands');
  pushCodeList(lines, receipt.proofStatus.staleCommands);
  lines.push('');
  lines.push('## Evidence Gaps');
  pushList(lines, receipt.evidenceGaps, 'No evidence gaps reported.');
  lines.push('');
  lines.push('## Reviewer Guidance');
  lines.push(receipt.reviewerGuidance);
  lines.push('');
  lines.push('## Reviewer Checklist');
  lines.push('- [ ] Confirm unexpected production/config/security files are intentional or removed.');
  lines.push('- [ ] Confirm expected tests or a documented regression-test gap cover the change.');
  lines.push('- [ ] Run every required proof command before approval.');
  lines.push('- [ ] Confirm new risks and evidence gaps are acceptable for this commit.');
  lines.push('');
  lines.push('## Copyable Decision');
  lines.push(
    `projscan prove: ${receipt.commitReadiness} (${receipt.scope.status}); proof ${receipt.proofStatus.status}; reviewer decision ${receipt.reviewerDecision}.`,
  );
  return lines.join('\n');
}

function printList(values: string[], empty: string): void {
  if (values.length === 0) {
    console.log(`- ${empty}`);
    return;
  }
  for (const value of values) console.log(`- ${value}`);
}

function pushList(lines: string[], values: string[], empty: string): void {
  if (values.length === 0) {
    lines.push(`- ${empty}`);
    return;
  }
  for (const value of values) lines.push(`- ${value}`);
}

function pushCodeList(lines: string[], values: string[]): void {
  if (values.length === 0) {
    lines.push('- No proof commands required.');
    return;
  }
  for (const value of values) lines.push(`- \`${value}\``);
}

function pushCommandEvidence(lines: string[], values: ProveReceipt['proofStatus']['commandEvidence']): void {
  if (values.length === 0) {
    lines.push('- No proof command evidence recorded.');
    return;
  }
  for (const value of values) lines.push(formatCommandEvidence(value));
}

function formatCommandEvidence(value: ProveReceipt['proofStatus']['commandEvidence'][number]): string {
  const state = value.fresh ? 'fresh' : value.staleReason ? 'stale' : value.status;
  const exit = typeof value.exitCode === 'number' ? ` exit ${value.exitCode}` : ' no exit code';
  const duration = typeof value.durationMs === 'number' ? `, ${value.durationMs}ms` : '';
  const log = value.logPath ? `, log ${value.logPath}` : '';
  const summary = value.outputSummary ? ` - ${value.outputSummary}` : '';
  const stale = value.staleReason ? ` (${value.staleReason})` : '';
  return `- **${value.status} ${state}:** \`${value.command}\` (${exit}${duration}${log})${stale}${summary}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}

function parseExitCode(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('exit code must be a non-negative integer');
  }
  return parsed;
}

function parseDurationMs(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('duration-ms must be a non-negative number');
  }
  return parsed;
}
