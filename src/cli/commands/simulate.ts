import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeSimulation } from '../../core/simulate.js';
import type { SimulateCandidateFile, SimulateReport } from '../../types/simulate.js';

export function registerSimulate(): void {
  program
    .command('simulate')
    .description('Simulate a proposed change plan with local evidence and projected risk delta')
    .requiredOption('--plan <text>', 'plain-language change plan to simulate')
    .option('--max-files <count>', 'maximum likely touched files to return', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('simulate');

      try {
        const report = await computeSimulation(getRootPath(), {
          plan: cmdOpts.plan,
          maxFiles: cmdOpts.maxFiles,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        if (format === 'markdown') {
          console.log(renderSimulateMarkdown(report));
          return;
        }
        printSimulateConsole(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printSimulateConsole(report: SimulateReport): void {
  const color =
    report.verdict === 'worth-doing'
      ? chalk.green
      : report.verdict === 'needs-more-evidence'
        ? chalk.yellow
        : chalk.gray;
  console.log(color(`Projscan Simulate: ${report.verdict}`));
  console.log(report.summary);
  console.log('');
  console.log(chalk.bold('Files Likely Touched'));
  if (report.filesLikelyTouched.length === 0) console.log('- No concrete file matched the plan');
  for (const file of report.filesLikelyTouched) console.log(renderCandidateConsole(file));
  console.log('');
  console.log(chalk.bold('Proof Commands'));
  for (const command of report.proofCommands.slice(0, 6)) console.log(`- ${command}`);
}

export function renderSimulateMarkdown(report: SimulateReport): string {
  const lines: string[] = [];
  lines.push('# Projscan Simulate');
  lines.push('');
  lines.push(`- **Verdict:** ${report.verdict}`);
  lines.push(`- **Confidence:** ${report.confidence}`);
  lines.push(`- **Plan:** ${report.plan}`);
  lines.push(`- **Summary:** ${report.summary}`);
  lines.push(`- **Risk delta:** +${report.riskDelta.delta}`);
  lines.push('');
  lines.push('## Files Likely Touched');
  lines.push('');
  if (report.filesLikelyTouched.length === 0) {
    lines.push('- No concrete file matched the plan.');
  } else {
    for (const file of report.filesLikelyTouched) {
      lines.push(`- **${file.path}** (${file.score})`);
      for (const reason of file.reasons) lines.push(`  - ${reason}`);
    }
  }
  lines.push('');
  lines.push('## Tests Likely Affected');
  lines.push('');
  if (report.testsLikelyAffected.length === 0) lines.push('- Add or identify a regression test first.');
  for (const test of report.testsLikelyAffected) lines.push(`- \`${test}\``);
  lines.push('');
  lines.push('## Contracts Likely Affected');
  lines.push('');
  if (report.contractsLikelyAffected.length === 0) lines.push('- No public contract inferred.');
  for (const contract of report.contractsLikelyAffected) lines.push(`- ${contract}`);
  lines.push('');
  lines.push('## Rollout Plan');
  lines.push('');
  for (const step of report.rolloutPlan) {
    lines.push(`### ${step.title}`);
    lines.push('');
    lines.push(step.detail);
    lines.push('');
    for (const command of step.commands) lines.push(`- \`${command}\``);
    lines.push('');
  }
  lines.push('## Proof Commands');
  lines.push('');
  for (const command of report.proofCommands) lines.push(`- \`${command}\``);
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    lines.push('');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }
  return lines.join('\n');
}

function renderCandidateConsole(file: SimulateCandidateFile): string {
  return `- ${file.path} (${file.score}): ${file.reasons[0] ?? 'local evidence'}`;
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}

