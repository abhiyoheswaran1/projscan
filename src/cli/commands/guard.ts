import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeGuard } from '../../core/guard.js';
import { escapeMarkdownText, markdownInlineCode } from '../../core/markdownSafety.js';
import type { GuardReport } from '../../types/guard.js';

export function registerGuard(): void {
  program
    .command('guard')
    .description('Check the current working tree against a saved Proof Contract')
    .option('--contract <path>', 'Proof Contract JSON path')
    .option('--base-ref <ref>', 'base ref for changed-file detection')
    .option('--ledger <path>', 'proof ledger JSONL path')
    .option('--fail-on-drift', 'exit non-zero when scope drift or missing contract is detected')
    .option('--watch', 'poll for guard status changes until interrupted')
    .option('--interval-ms <ms>', 'watch poll interval in milliseconds', parsePositiveInt, 2000)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('guard');

      try {
        const options = {
          contractPath: cmdOpts.contract,
          baseRef: cmdOpts.baseRef,
          ledgerPath: cmdOpts.ledger,
        };
        if (cmdOpts.watch) {
          await watchGuard(options, {
            format,
            intervalMs: cmdOpts.intervalMs,
            failOnDrift: Boolean(cmdOpts.failOnDrift),
          });
          return;
        }
        const report = await computeGuard(getRootPath(), options);
        printGuard(report, format);
        if (cmdOpts.failOnDrift && (report.status === 'drift' || report.status === 'blocked')) {
          process.exit(report.exitCode);
        }
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

async function watchGuard(
  options: { contractPath?: string; baseRef?: string; ledgerPath?: string },
  settings: { format: string; intervalMs: number; failOnDrift: boolean },
): Promise<void> {
  let last = '';
  let stopped = false;
  const stop = (): void => {
    stopped = true;
  };
  process.once('SIGINT', stop);
  while (!stopped) {
    const report = await computeGuard(getRootPath(), options);
    const key = JSON.stringify({
      status: report.status,
      drift: report.drift.files,
      proof: report.proof.status,
      missing: report.proof.missingCommands,
      stale: report.proof.staleCommands,
      failed: report.proof.failedCommands,
    });
    if (key !== last) {
      printGuard(report, settings.format);
      last = key;
      if (settings.failOnDrift && (report.status === 'drift' || report.status === 'blocked')) {
        process.exit(report.exitCode);
      }
    }
    await delay(settings.intervalMs);
  }
}

function printGuard(report: GuardReport, format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (format === 'markdown') {
    console.log(renderGuardMarkdown(report));
    return;
  }
  printGuardConsole(report);
}

function printGuardConsole(report: GuardReport): void {
  const color =
    report.status === 'blocked' || report.status === 'drift'
      ? chalk.red
      : report.status === 'attention'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Projscan Guard: ${report.status}`));
  console.log(report.summary);
  console.log('');
  console.log(chalk.bold('Drift'));
  printList(report.drift.files, 'No scope drift detected');
  console.log('');
  console.log(chalk.bold('Proof'));
  console.log(`- status: ${report.proof.status}`);
  console.log(`- sufficiency: ${report.proof.sufficiencyStatus ?? 'unknown'}`);
  printList(report.proof.missingCommands.slice(0, 5), 'No missing proof commands');
}

export function renderGuardMarkdown(report: GuardReport): string {
  const lines = [
    '# Projscan Guard',
    '',
    `- **Status:** ${report.status}`,
    `- **Summary:** ${escapeMarkdownText(report.summary)}`,
    `- **Reviewer action:** ${report.reviewerAction}`,
    `- **Exit code:** ${report.exitCode}`,
    '',
    '## Drift',
    '',
  ];
  renderList(lines, report.drift.files);
  lines.push('');
  lines.push('## Proof');
  lines.push('');
  lines.push(`- **Status:** ${report.proof.status}`);
  lines.push(`- **Sufficiency:** ${report.proof.sufficiencyStatus ?? 'unknown'}`);
  renderCommandGroup(lines, 'Missing', report.proof.missingCommands);
  renderCommandGroup(lines, 'Failed', report.proof.failedCommands);
  renderCommandGroup(lines, 'Stale', report.proof.staleCommands);
  return lines.join('\n');
}

function renderCommandGroup(lines: string[], label: string, values: string[]): void {
  lines.push(`- **${label}:**`);
  if (values.length === 0) {
    lines.push('  - none');
    return;
  }
  for (const value of values) lines.push(`  - ${markdownInlineCode(value)}`);
}

function renderList(lines: string[], values: string[]): void {
  if (values.length === 0) {
    lines.push('- none');
    return;
  }
  for (const value of values) lines.push(`- ${markdownInlineCode(value)}`);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
