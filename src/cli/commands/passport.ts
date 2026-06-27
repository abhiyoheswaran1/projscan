import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  loadProjectConfig,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computePassport } from '../../core/passport.js';
import { escapeMarkdownText, markdownInlineCode } from '../../core/markdownSafety.js';
import type { AgentChangePassport } from '../../types/passport.js';

export function registerPassport(): void {
  program
    .command('passport')
    .description('Create an Agent Change Passport from a Proof Contract and current proof receipt')
    .option('--intent <text>', 'plain-language change intent to contract before or during work')
    .option('--contract <path>', 'existing Proof Contract JSON path')
    .option('--save-contract <path>', 'write the generated Proof Contract JSON when --intent is supplied')
    .option('--output <path>', 'write passport JSON to .projscan/passport.json or .projscan/passports/<name>.json')
    .option('--max-files <count>', 'maximum likely touched files to include in a generated contract', parsePositiveInt)
    .option('--feedback <path>', 'local projscan feedback artifact to apply as trust memory')
    .option('--base-ref <ref>', 'base ref for changed-file detection')
    .option('--ledger <path>', 'proof ledger JSONL path')
    .option('--task-id <id>', 'Baseframe task ID for attached assessment evidence')
    .option('--emit-baseframe', 'write the Baseframe ProjScan assessment artifact')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('passport');

      try {
        const config = await loadProjectConfig();
        const passport = await computePassport(getRootPath(), {
          intent: cmdOpts.intent,
          contractPath: cmdOpts.contract,
          saveContractPath: cmdOpts.saveContract,
          outputPath: cmdOpts.output,
          maxFiles: cmdOpts.maxFiles,
          feedbackPath: cmdOpts.feedback,
          baseRef: cmdOpts.baseRef,
          ledgerPath: cmdOpts.ledger,
          taskId: cmdOpts.taskId,
          emitBaseframe: Boolean(cmdOpts.emitBaseframe),
          proofRecipes: config.proofRecipes,
        });

        if (format === 'json') {
          console.log(JSON.stringify(passport, null, 2));
          return;
        }
        if (format === 'markdown') {
          console.log(renderPassportMarkdown(passport));
          return;
        }
        printPassportConsole(passport);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printPassportConsole(passport: AgentChangePassport): void {
  const color =
    passport.status === 'blocked' || passport.status === 'drifted'
      ? chalk.red
      : passport.status === 'needs-proof'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Projscan Passport: ${passport.status}`));
  console.log(passport.summary);
  console.log('');
  console.log(chalk.bold('Reviewer'));
  console.log(`- decision: ${passport.reviewer.decision}`);
  console.log(`- action: ${passport.reviewer.action}`);
  console.log(`- ${passport.reviewer.summary}`);
  console.log('');
  console.log(chalk.bold('Boundary'));
  printList(passport.boundary.allowedFiles.slice(0, 8), 'No allowed files in contract');
  if (passport.boundary.forbiddenFiles.length > 0) {
    console.log('');
    console.log(chalk.bold('Forbidden'));
    printList(passport.boundary.forbiddenFiles.slice(0, 8), 'No forbidden files in contract');
  }
  console.log('');
  console.log(chalk.bold('Receipt'));
  console.log(`- scope: ${passport.receipt.scopeStatus}`);
  console.log(`- proof: ${passport.receipt.proofStatus}`);
  console.log(`- sufficiency: ${passport.receipt.proofSufficiencyStatus ?? 'unknown'}`);
  console.log(`- changed files: ${passport.receipt.changedFiles.length}`);
  console.log('');
  console.log(chalk.bold('Next Commands'));
  printList(passport.nextCommands.slice(0, 8), 'No next commands');
}

export function renderPassportMarkdown(passport: AgentChangePassport): string {
  const lines: string[] = [
    '# Projscan Agent Change Passport',
    '',
    `- **Status:** ${passport.status}`,
    `- **Summary:** ${escapeMarkdownText(passport.summary)}`,
    `- **Reviewer action:** ${passport.reviewer.action}`,
    `- **Reviewer decision:** ${passport.reviewer.decision}`,
  ];
  if (passport.intent) lines.push(`- **Intent:** ${escapeMarkdownText(passport.intent)}`);
  if (passport.artifacts.contractPath) {
    lines.push(`- **Contract:** ${markdownInlineCode(passport.artifacts.contractPath)}`);
  }
  if (passport.artifacts.passportPath) {
    lines.push(`- **Passport:** ${markdownInlineCode(passport.artifacts.passportPath)}`);
  }
  if (passport.baseframe) {
    lines.push(`- **Baseframe assessment:** ${markdownInlineCode(passport.baseframe.assessmentPath)}`);
  }
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  renderCommandOrFileList(lines, 'Allowed files', passport.boundary.allowedFiles);
  renderCommandOrFileList(lines, 'Forbidden files', passport.boundary.forbiddenFiles);
  renderCommandOrFileList(lines, 'Likely tests', passport.boundary.likelyTests);
  renderCommandOrFileList(lines, 'Proof commands', passport.boundary.proofCommands);
  lines.push('');
  lines.push('## Receipt');
  lines.push('');
  lines.push(`- **Scope:** ${passport.receipt.scopeStatus}`);
  lines.push(`- **Proof:** ${passport.receipt.proofStatus}`);
  lines.push(`- **Proof sufficiency:** ${passport.receipt.proofSufficiencyStatus ?? 'unknown'}`);
  lines.push(`- **Proof replay:** ${passport.receipt.proofReplayStatus ?? 'unknown'}`);
  renderCommandOrFileList(lines, 'Changed files', passport.receipt.changedFiles);
  renderCommandOrFileList(lines, 'Forbidden touched', passport.receipt.forbiddenTouched);
  renderCommandOrFileList(lines, 'Outside allowed', passport.receipt.outsideAllowed);
  renderCommandOrFileList(lines, 'Changed after proof', passport.receipt.changedAfterProof);
  lines.push('');
  lines.push('## Next Commands');
  lines.push('');
  for (const command of passport.nextCommands) lines.push(`- ${markdownInlineCode(command)}`);
  return lines.join('\n');
}

function renderCommandOrFileList(lines: string[], label: string, values: string[]): void {
  lines.push(`- **${label}:**`);
  if (values.length === 0) {
    lines.push('  - none');
    return;
  }
  for (const value of values.slice(0, 12)) lines.push(`  - ${markdownInlineCode(value)}`);
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
