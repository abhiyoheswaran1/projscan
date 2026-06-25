import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  loadProjectConfig,
  setupLogLevel,
} from '../_shared.js';
import { computeProve } from '../../core/prove.js';
import {
  escapeMarkdownText,
  markdownInlineCode,
  markdownInlineList,
} from '../../core/markdownSafety.js';
import type {
  ProveContract,
  ProveProofReplay,
  ProveProofSufficiency,
  ProveReceipt,
  ProveReport,
  ProveVerifiedWorkflow,
} from '../../types/prove.js';
import type { ProofLedgerSource } from '../../types/proofLedger.js';

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
    .option('--record-source <source>', 'source for --record-command evidence', parseProofLedgerSource)
    .option('--run', 'execute a local proof command supplied after -- and record the outcome')
    .option('--run-timeout-ms <ms>', 'timeout in milliseconds for --run commands', parseDurationMs)
    .option('--ledger <path>', 'proof ledger JSONL path')
    .argument('[runCommand...]', 'command vector for --run after --')
    .action(async (runCommand: string[], cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('prove');

      try {
        const runArgs = Array.isArray(runCommand) ? runCommand : [];
        const selectedModes = [cmdOpts.intent, cmdOpts.changed, cmdOpts.recordCommand, cmdOpts.run].filter(Boolean);
        if (selectedModes.length > 1) {
          throw new Error('prove accepts either --intent, --changed, --record-command, or --run');
        }
        if (selectedModes.length === 0) {
          throw new Error('prove requires --intent "<change>", --changed, --record-command, or --run -- <command>');
        }
        if (!cmdOpts.run && runArgs.length > 0) {
          throw new Error('prove command arguments require --run before the -- delimiter');
        }
        if (cmdOpts.run && runArgs.length === 0) {
          throw new Error('prove --run requires a command after --, for example: projscan prove --run -- npm test');
        }
        if (cmdOpts.recordSource && !cmdOpts.recordCommand) {
          throw new Error('prove --record-source requires --record-command');
        }
        const config = await loadProjectConfig();
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
          recordSource: cmdOpts.recordSource,
          runCommand: cmdOpts.run ? runArgs : undefined,
          runTimeoutMs: cmdOpts.runTimeoutMs,
          proofRecipes: cmdOpts.changed ? undefined : config.proofRecipes,
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
  printVerifiedWorkflowConsole(report.verifiedWorkflow);
  console.log('');
  if (report.contract && report.mode === 'intent') {
    printContractConsole(report.contract);
  }
  if (report.ledgerRecord) {
    console.log(chalk.bold(report.ledgerRecord.source === 'prove-run' ? 'Executed Proof' : 'Recorded Proof'));
    console.log(`- ${report.ledgerRecord.status}: ${report.ledgerRecord.command}`);
    console.log(`- source: ${report.ledgerRecord.source}`);
    console.log(`- ${report.ledgerRecord.changedFiles.length} changed file(s) fingerprinted`);
  }
  if (report.receipt) {
    printReceiptConsole(report.receipt);
  }
}

function printVerifiedWorkflowConsole(workflow: ProveVerifiedWorkflow): void {
  console.log(chalk.bold('Verified Workflow'));
  console.log(`- next action: ${workflow.nextAction}`);
  console.log(`- next command: ${workflow.nextCommand}`);
  console.log(`- stale proof: ${workflow.staleProof ? 'yes' : 'no'}`);
  console.log(`- missing proof: ${workflow.missingProof ? 'yes' : 'no'}`);
  console.log(`- failed proof: ${workflow.failedProof ? 'yes' : 'no'}`);
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
  const proofReplay = proofReplayForReceipt(receipt);
  const proofSufficiency = proofSufficiencyForReceipt(receipt);
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
  if (receipt.teamProofRecipes?.length) {
    console.log('');
    console.log(chalk.bold('Team Proof Recipes'));
    for (const recipe of receipt.teamProofRecipes) {
      const reviewers = recipe.requiredReviewers?.length ? recipe.requiredReviewers.join(', ') : 'none';
      const drift = recipe.forbiddenTouched?.length ? recipe.forbiddenTouched.join(', ') : 'none';
      console.log(`- ${recipe.id}: reviewers ${reviewers}; recipe drift ${drift}`);
    }
  }
  console.log('');
  console.log(chalk.bold('Proof Replay'));
  console.log(`- replay status: ${proofReplay.status}`);
  console.log(`- proof status: ${receipt.proofStatus.status}`);
  console.log(`- reviewer decision: ${receipt.reviewerDecision}`);
  console.log(`- changed after proof: ${inlineList(proofReplay.changedAfterProof)}`);
  console.log(`- receipt fingerprint: ${proofReplay.receiptFingerprint}`);
  console.log('');
  console.log(chalk.bold('Proof Sufficiency'));
  console.log(`- status: ${proofSufficiency.status}`);
  for (const gap of proofSufficiency.gaps.slice(0, 3)) {
    console.log(`- gap: ${gap}`);
  }
}

export function renderProveMarkdown(report: ProveReport): string {
  if (report.receipt) return renderReceiptMarkdown(report, report.receipt);
  if (report.ledgerRecord) return renderLedgerRecordMarkdown(report);
  return renderContractMarkdown(report);
}

function renderLedgerRecordMarkdown(report: ProveReport): string {
  const record = report.ledgerRecord;
  const lines: string[] = [
    record?.source === 'prove-run' ? '# Projscan Executed Proof' : '# Projscan Recorded Proof',
    '',
    `- **Verdict:** ${report.verdict}`,
    `- **Summary:** ${escapeMarkdownText(report.summary)}`,
  ];
  if (!record) return lines.join('\n');
  lines.push(`- **Source:** ${record.source}`);
  lines.push(`- **Status:** ${record.status}`);
  lines.push(`- **Command:** ${markdownInlineCode(record.command)}`);
  lines.push(`- **Exit code:** ${record.exitCode}`);
  lines.push(`- **Duration:** ${record.durationMs}ms`);
  lines.push(`- **Completed:** ${record.completedAt}`);
  lines.push(`- **Changed-file fingerprint:** ${record.changedFileFingerprint}`);
  if (record.logPath) lines.push(`- **Log:** ${markdownInlineCode(record.logPath)}`);
  lines.push('');
  pushVerifiedWorkflow(lines, report.verifiedWorkflow);
  lines.push('');
  lines.push('## Output Summary');
  lines.push(escapeMarkdownText(record.outputSummary));
  lines.push('');
  lines.push('## Changed Files');
  pushList(lines, record.changedFiles, 'No changed files were fingerprinted.');
  lines.push('');
  lines.push('## Replay');
  lines.push('Run `projscan prove --changed --contract .projscan/proof-contract.json --format markdown` after the edit to replay this proof against the current diff.');
  return lines.join('\n');
}

function renderContractMarkdown(report: ProveReport): string {
  const contract = report.contract;
  const lines: string[] = ['# Projscan Proof Contract', ''];
  lines.push(`- **Verdict:** ${report.verdict}`);
  lines.push(`- **Summary:** ${escapeMarkdownText(report.summary)}`);
  if (!contract) return lines.join('\n');
  lines.push(`- **Intent:** ${escapeMarkdownText(contract.intent)}`);
  lines.push(`- **Confidence:** ${contract.confidence}`);
  lines.push(`- **Evidence strength:** ${contract.evidenceStrength.level} (${contract.evidenceStrength.score})`);
  lines.push('');
  pushVerifiedWorkflow(lines, report.verifiedWorkflow);
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
  lines.push(escapeMarkdownText(contract.reviewerGuidance));
  return lines.join('\n');
}

function renderReceiptMarkdown(report: ProveReport, receipt: ProveReceipt): string {
  const proofReplay = proofReplayForReceipt(receipt);
  const proofSufficiency = proofSufficiencyForReceipt(receipt);
  const lines: string[] = ['# Projscan Proof Receipt', ''];
  lines.push(`- **Verdict:** ${report.verdict}`);
  lines.push(`- **Summary:** ${escapeMarkdownText(receipt.summary)}`);
  lines.push(`- **Commit readiness:** ${receipt.commitReadiness}`);
  lines.push(`- **Scope:** ${receipt.scope.status}`);
  lines.push(`- **Proof status:** ${receipt.proofStatus.status}`);
  lines.push(`- **Reviewer decision:** ${receipt.reviewerDecision}`);
  lines.push('');
  pushVerifiedWorkflow(lines, report.verifiedWorkflow);
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
  lines.push('## Team Proof Recipes');
  pushTeamProofRecipes(lines, receipt);
  lines.push('');
  lines.push('## Proof Replay');
  lines.push(`- **replay status:** ${proofReplay.status}`);
  lines.push(`- **summary:** ${escapeMarkdownText(proofReplay.summary)}`);
  lines.push(`- **proof status:** ${receipt.proofStatus.status}`);
  lines.push(`- **Reviewer decision:** ${receipt.reviewerDecision}`);
  lines.push(`- **risk delta:** ${receipt.riskDeltaDirection} (${receipt.riskDelta.delta})`);
  lines.push(`- **commands required:** ${receipt.proofStatus.commandsRequired.length}`);
  lines.push(`- **commands recorded:** ${receipt.proofStatus.commandsRun.length}`);
  lines.push(`- **changed after proof:** ${markdownInlineList(proofReplay.changedAfterProof)}`);
  lines.push(`- **replay command:** ${markdownInlineCode(proofReplay.replayCommand)}`);
  lines.push(`- **receipt fingerprint:** ${markdownInlineCode(proofReplay.receiptFingerprint)}`);
  lines.push('');
  lines.push('### Replay Timeline');
  pushReplayEvents(lines, proofReplay.events);
  lines.push('');
  lines.push('## Proof Sufficiency');
  lines.push(`- **sufficiency status:** ${proofSufficiency.status}`);
  lines.push(`- **summary:** ${escapeMarkdownText(proofSufficiency.summary)}`);
  lines.push(`- **weak requirements:** ${proofSufficiency.weakRequirements.length}`);
  lines.push(`- **missing requirements:** ${proofSufficiency.missingRequirements.length}`);
  lines.push(`- **stale requirements:** ${proofSufficiency.staleRequirements.length}`);
  lines.push(`- **failed requirements:** ${proofSufficiency.failedRequirements.length}`);
  lines.push('');
  lines.push('### Requirement Evidence');
  pushRequirementEvidence(lines, proofSufficiency.requirements);
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
  lines.push(escapeMarkdownText(receipt.reviewerGuidance));
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

function pushVerifiedWorkflow(lines: string[], workflow: ProveVerifiedWorkflow): void {
  lines.push('## Verified Workflow');
  lines.push(`- **phase:** ${workflow.phase}`);
  lines.push(`- **status:** ${workflow.status}`);
  lines.push(`- **next action:** ${escapeMarkdownText(workflow.nextAction)}`);
  lines.push(`- **next command:** ${markdownInlineCode(workflow.nextCommand)}`);
  if (workflow.scopeStatus) lines.push(`- **scope:** ${workflow.scopeStatus}`);
  if (workflow.proofStatus) lines.push(`- **proof:** ${workflow.proofStatus}`);
  if (workflow.proofSufficiencyStatus) {
    lines.push(`- **proof sufficiency:** ${workflow.proofSufficiencyStatus}`);
  }
  if (workflow.reviewerDecision) lines.push(`- **reviewer decision:** ${workflow.reviewerDecision}`);
  if (workflow.riskDeltaDirection) lines.push(`- **risk delta:** ${workflow.riskDeltaDirection}`);
  lines.push(`- **stale proof:** ${workflow.staleProof ? 'yes' : 'no'}`);
  lines.push(`- **missing proof:** ${workflow.missingProof ? 'yes' : 'no'}`);
  lines.push(`- **failed proof:** ${workflow.failedProof ? 'yes' : 'no'}`);
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
  for (const value of values) lines.push(`- ${escapeMarkdownText(value)}`);
}

function pushCodeList(lines: string[], values: string[]): void {
  if (values.length === 0) {
    lines.push('- No proof commands required.');
    return;
  }
  for (const value of values) lines.push(`- ${markdownInlineCode(value)}`);
}

function pushTeamProofRecipes(lines: string[], receipt: ProveReceipt): void {
  const recipes = receipt.teamProofRecipes ?? [];
  if (recipes.length === 0) {
    lines.push('- No Team Proof Recipes matched this receipt.');
    return;
  }
  for (const recipe of recipes) {
    lines.push(`- **recipe:** ${markdownInlineCode(recipe.id)}`);
    lines.push(`  - matched files: ${markdownInlineList(recipe.matchedFiles)}`);
    lines.push(`  - required reviewers: ${markdownInlineList(recipe.requiredReviewers ?? [])}`);
    lines.push(`  - recipe drift: ${markdownInlineList(recipe.forbiddenTouched ?? [])}`);
    lines.push(`  - recipe proof gaps: ${markdownInlineList(recipeGapsForRecipe(recipe))}`);
  }
  if (receipt.requiredReviewers?.length) {
    lines.push(`- **required reviewers:** ${markdownInlineList(receipt.requiredReviewers)}`);
  }
  if (receipt.recipeDrift?.length) {
    lines.push(`- **recipe drift:** ${markdownInlineList(receipt.recipeDrift)}`);
  }
  if (receipt.recipeGaps?.length) {
    lines.push(`- **recipe gaps:** ${markdownInlineList(receipt.recipeGaps)}`);
  }
}

function recipeGapsForRecipe(recipe: NonNullable<ProveReceipt['teamProofRecipes']>[number]): string[] {
  return [
    ...(recipe.missingCommands ?? []).map((command) => `missing: ${command}`),
    ...(recipe.failedCommands ?? []).map((command) => `failed: ${command}`),
    ...(recipe.staleCommands ?? []).map((command) => `stale: ${command}`),
  ];
}

function pushCommandEvidence(lines: string[], values: ProveReceipt['proofStatus']['commandEvidence']): void {
  if (values.length === 0) {
    lines.push('- No proof command evidence recorded.');
    return;
  }
  for (const value of values) lines.push(formatCommandEvidence(value));
}

function pushRequirementEvidence(
  lines: string[],
  values: ProveProofSufficiency['requirements'],
): void {
  if (values.length === 0) {
    lines.push('- No proof requirements were evaluated.');
    return;
  }
  for (const value of values) lines.push(formatRequirementEvidence(value));
}

function pushReplayEvents(lines: string[], values: ProveProofReplay['events']): void {
  if (values.length === 0) {
    lines.push('- No proof replay events recorded.');
    return;
  }
  for (const value of values) lines.push(formatReplayEvent(value));
}

function formatReplayEvent(value: ProveProofReplay['events'][number]): string {
  const command = value.command ? ` ${markdownInlineCode(value.command)}` : '';
  const source = value.source ? ` source: ${value.source}.` : '';
  const changedAfter =
    value.changedAfterProof && value.changedAfterProof.length > 0
      ? ` changed after proof: ${markdownInlineList(value.changedAfterProof)}.`
      : '';
  const completedAt = value.completedAt ? ` completed: ${escapeMarkdownText(value.completedAt)}.` : '';
  return `- **${value.status} ${value.kind}:**${command} ${escapeMarkdownText(value.summary)}${source}${changedAfter}${completedAt}`;
}

function formatRequirementEvidence(
  value: ProveProofSufficiency['requirements'][number],
): string {
  const files = value.files.length > 0 ? value.files.join(', ') : 'contract-only';
  const commands =
    value.requiredCommands.length > 0 ? value.requiredCommands.join('; ') : 'no command required';
  const matched = value.matchedCommands.length > 0 ? value.matchedCommands.join('; ') : 'none';
  const gaps = value.gaps.length > 0 ? ` gaps: ${value.gaps.join('; ')}` : '';
  return `- **${value.status} ${value.surface}:** ${escapeMarkdownText(files)}; required: ${escapeMarkdownText(commands)}; matched: ${escapeMarkdownText(matched)}.${escapeMarkdownText(gaps)}`;
}

function formatCommandEvidence(value: ProveReceipt['proofStatus']['commandEvidence'][number]): string {
  const state = value.fresh ? 'fresh' : value.staleReason ? 'stale' : value.status;
  const exit = typeof value.exitCode === 'number' ? ` exit ${value.exitCode}` : ' no exit code';
  const duration = typeof value.durationMs === 'number' ? `, ${value.durationMs}ms` : '';
  const source = value.source ? `, source ${value.source}` : '';
  const log = value.logPath ? `, log ${markdownInlineCode(value.logPath)}` : '';
  const summary = value.outputSummary ? ` - ${escapeMarkdownText(value.outputSummary)}` : '';
  const stale = value.staleReason ? ` (${escapeMarkdownText(value.staleReason)})` : '';
  return `- **${value.status} ${state}:** ${markdownInlineCode(value.command)} (${exit}${duration}${source}${log})${stale}${summary}`;
}

function inlineList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function proofReplayForReceipt(receipt: ProveReceipt): ProveProofReplay {
  return (
    receipt.proofReplay ?? {
      status: 'needs-proof',
      summary: 'No proof replay evidence recorded.',
      events: [],
      changedAfterProof: [],
      replayCommand: 'projscan prove --changed --format markdown',
      receiptFingerprint: 'missing',
    }
  );
}

function proofSufficiencyForReceipt(receipt: ProveReceipt): ProveProofSufficiency {
  return (
    receipt.proofSufficiency ?? {
      status: 'missing',
      summary: 'No proof sufficiency evidence recorded.',
      requirements: [],
      gaps: ['No proof sufficiency evidence recorded.'],
      weakRequirements: [],
      missingRequirements: [],
      staleRequirements: [],
      failedRequirements: [],
    }
  );
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

function parseProofLedgerSource(value: string): ProofLedgerSource {
  if (value === 'prove-record' || value === 'prove-run' || value === 'mission' || value === 'external') {
    return value;
  }
  throw new Error('record-source must be prove-record, prove-run, mission, or external');
}
