import fs from 'node:fs/promises';
import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeAssess } from '../../core/assess.js';
import type { AssessMode, AssessProofCard, AssessReport } from '../../types/assess.js';

const ASSESS_MODES = ['standard', 'fix-first', 'ship-readiness'] as const satisfies AssessMode[];

export function registerAssess(): void {
  program
    .command('assess')
    .description('Run a proof-first codebase assessment with evidence-backed Proof Cards')
    .option('--goal <text>', 'plain-language assessment goal')
    .option('--mode <mode>', 'assessment mode: standard, fix-first, ship-readiness', parseMode)
    .option('--max-cards <count>', 'maximum Proof Cards to return', parsePositiveInt)
    .option('--baseline <path>', 'prior assess JSON file to compare risk delta against')
    .option('--feedback <path>', 'local projscan feedback artifact to apply as trust memory')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('assess');

      try {
        const report = await computeAssess(getRootPath(), {
          goal: cmdOpts.goal,
          mode: cmdOpts.mode,
          maxCards: cmdOpts.maxCards,
          feedbackPath: cmdOpts.feedback,
          ...(cmdOpts.baseline
            ? {
                baselineReport: await readAssessBaseline(cmdOpts.baseline),
                baselinePath: cmdOpts.baseline,
              }
            : {}),
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        if (format === 'markdown') {
          console.log(renderAssessMarkdown(report));
          return;
        }
        printAssessConsole(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printAssessConsole(report: AssessReport): void {
  const color =
    report.verdict === 'blocked' ? chalk.red : report.verdict === 'watch' ? chalk.yellow : chalk.green;
  console.log(color(`Projscan Assess: ${report.verdict}`));
  console.log(report.summary);
  console.log('');
  console.log(chalk.bold('Fix First'));
  console.log(report.fixFirst ? `- ${report.fixFirst.finding}` : '- Preserve the baseline');
  console.log('');
  console.log(chalk.bold('Verification'));
  for (const command of report.answers.testsThatProveIt) console.log(`- ${command}`);
}

export function renderAssessMarkdown(report: AssessReport): string {
  const lines: string[] = [];
  lines.push('# Projscan Assess');
  lines.push('');
  lines.push(`- **Verdict:** ${report.verdict}`);
  lines.push(`- **Mode:** ${report.mode}`);
  lines.push(`- **Goal:** ${report.goal}`);
  lines.push(`- **Summary:** ${report.summary}`);
  if (report.baselineComparison)
    lines.push(`- **Baseline:** ${report.baselineComparison.summary}`);
  lines.push('');
  lines.push('## Answers');
  lines.push('');
  lines.push(`- **Actually risky:** ${report.answers.actuallyRisky}`);
  lines.push(`- **Why risky:** ${report.answers.whyRisky}`);
  lines.push(`- **Fix first:** ${report.answers.fixFirst}`);
  lines.push(`- **Safest change:** ${report.answers.safestChange}`);
  lines.push(`- **Risk removed:** ${report.answers.riskRemoved}`);
  lines.push(`- **Ship now:** ${report.answers.shipNow}`);
  lines.push('');
  lines.push('## Proof Cards');
  lines.push('');
  for (const card of report.proofCards) renderProofCard(lines, card);
  if (report.proofCards.length === 0) lines.push('- No proof-backed actions outrank baseline verification.');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  for (const command of report.answers.testsThatProveIt) lines.push(`- \`${command}\``);
  lines.push('');
  lines.push('## Next Commands');
  lines.push('');
  for (const command of report.commands) lines.push(`- \`${command}\``);
  return lines.join('\n');
}

function renderProofCard(lines: string[], card: AssessProofCard): void {
  lines.push(`### ${card.finding}`);
  lines.push('');
  lines.push(`- **Priority:** ${card.priority}`);
  lines.push(`- **Confidence:** ${card.confidence}`);
  lines.push(`- **Confidence reason:** ${card.confidenceReason}`);
  lines.push(
    `- **Evidence strength:** ${card.evidenceStrength.level} (${card.evidenceStrength.score})`,
  );
  if (card.evidenceGaps.length > 0) {
    lines.push(`- **Evidence gaps:** ${card.evidenceGaps.join('; ')}`);
  }
  lines.push(`- **Ranking:** #${card.ranking.rank} (${card.ranking.score})`);
  if (card.ranking.reasons.length > 0) {
    lines.push(`- **Ranking reasons:** ${card.ranking.reasons.join(', ')}`);
  }
  lines.push(`- **Trust memory:** ${card.trustMemory.status} - ${card.trustMemory.summary}`);
  if (card.trustMemory.signals.length > 0) {
    lines.push(`- **Trust signals:** ${card.trustMemory.signals.join('; ')}`);
  }
  lines.push(`- **Why it matters:** ${card.whyItMatters}`);
  if (card.files.length > 0) lines.push(`- **Files:** ${card.files.join(', ')}`);
  lines.push(`- **Recommended fix:** ${card.recommendedFix.summary}`);
  lines.push(`- **Safe change:** ${card.recommendedFix.safeChangeShape}`);
  lines.push(`- **Risk delta:** ${card.riskDelta.delta}`);
  lines.push('- **Evidence:**');
  for (const evidence of card.evidence) {
    const file = evidence.file ? ` (${evidence.file})` : '';
    lines.push(`  - ${evidence.source}: ${evidence.detail}${file}`);
  }
  lines.push('- **Commands:**');
  for (const command of card.verification.commands) lines.push(`  - \`${command}\``);
  lines.push('- **AgentLoopKit Handoff:**');
  lines.push(`  - Title: ${card.agentHandoff.title}`);
  lines.push(`  - Scope: ${card.agentHandoff.scope.join(', ')}`);
  lines.push(`  - Rollback: ${card.agentHandoff.rollback}`);
  lines.push('  - Constraints:');
  for (const constraint of card.agentHandoff.constraints.slice(0, 4)) {
    lines.push(`    - ${constraint}`);
  }
  lines.push('  - Done when:');
  for (const criterion of card.agentHandoff.doneCriteria) {
    lines.push(`    - ${criterion}`);
  }
  lines.push('');
}

function parseMode(value: string): AssessMode {
  if ((ASSESS_MODES as readonly string[]).includes(value)) return value as AssessMode;
  throw new Error(`mode must be one of: ${ASSESS_MODES.join(', ')}`);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}

async function readAssessBaseline(filePath: string): Promise<AssessReport> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf-8')) as Partial<AssessReport>;
    if (
      parsed.schemaVersion !== 1 ||
      !parsed.riskDelta ||
      typeof parsed.riskDelta.projectedScore !== 'number'
    ) {
      throw new Error('invalid assess baseline shape');
    }
    return parsed as AssessReport;
  } catch (err) {
    throw new Error(
      `Could not read assess baseline ${filePath}: ${
        err instanceof Error ? err.message : 'invalid JSON'
      }`,
      { cause: err },
    );
  }
}
