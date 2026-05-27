import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeEvidencePack } from '../../core/releaseEvidence.js';
import type { EvidencePackArtifact, EvidencePackReport } from '../../types.js';

export function registerEvidencePack(): void {
  program
    .command('evidence-pack')
    .description('Assemble approval evidence from product planning, bug-hunt, workplan, and preflight signals')
    .option('--line <line>', 'product line to include, repeatable (default: next six minor lines)', collectLine, [])
    .option('--website-prompt', 'include website-update prompt text')
    .option('--pr-comment', 'print a GitHub PR comment markdown artifact')
    .option('--max-findings <count>', 'maximum bug-hunt findings to include', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('evidence-pack');

      try {
        const report = await computeEvidencePack(getRootPath(), {
          lines: cmdOpts.line,
          includeWebsitePrompt: cmdOpts.websitePrompt === true,
          includePrComment: cmdOpts.prComment === true,
          maxFindings: cmdOpts.maxFindings,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        if (cmdOpts.prComment === true && report.prComment) {
          console.log(report.prComment.trimEnd());
          return;
        }
        printEvidencePack(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function collectLine(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function printEvidencePack(report: EvidencePackReport): void {
  const color =
    report.verdict === 'blocked'
      ? chalk.red
      : report.verdict === 'caution'
        ? chalk.yellow
        : chalk.green;
  console.log(color(`Evidence Pack: ${report.verdict}`));
  console.log(report.summary);
  console.log(`Version: ${report.currentVersion ?? 'unknown'}`);
  console.log(`Product lines: ${report.train.lines.join(', ')}`);
  console.log('');
  console.log(chalk.bold('Artifacts'));
  for (const artifact of report.artifacts) {
    printArtifact(artifact);
  }
  console.log('');
  console.log(chalk.bold('Approval'));
  console.log(`- ${report.approval.recommendation}`);
  for (const reason of report.approval.blockingReasons.slice(0, 5)) {
    console.log(`- blocker: ${reason}`);
  }
}

function printArtifact(artifact: EvidencePackArtifact): void {
  console.log(`- ${chalk.bold(`[${artifact.status}] ${artifact.title}`)}`);
  console.log(`  ${artifact.summary}`);
  console.log(`  verify: ${artifact.commands.join(' && ')}`);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
