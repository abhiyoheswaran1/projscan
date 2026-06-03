import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeUnderstandReport } from '../../core/understand.js';
import type {
  UnderstandClaim,
  UnderstandEntrypoint,
  UnderstandReadFirst,
  UnderstandReport,
  UnderstandRisk,
  UnderstandUnknown,
  UnderstandView,
} from '../../types.js';

const VIEWS: readonly UnderstandView[] = ['map', 'flow', 'contracts', 'change', 'verify'];

export function registerUnderstand(): void {
  program
    .command('understand')
    .description('Explain the repo map, runtime flows, contracts, change readiness, and verification proof with cited evidence')
    .option('--view <view>', 'map, flow, contracts, change, or verify', 'map')
    .option('--intent <text>', 'planned change or question to orient change-readiness output')
    .option('--max-items <count>', 'maximum items per section', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('understand');
      const view = parseView(cmdOpts.view);

      try {
        const report = await computeUnderstandReport(getRootPath(), {
          view,
          intent: typeof cmdOpts.intent === 'string' ? cmdOpts.intent : undefined,
          maxItems: cmdOpts.maxItems,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printUnderstand(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printUnderstand(report: UnderstandReport): void {
  console.log(chalk.bold(`Understand: ${report.view}`));
  console.log(report.summary);
  console.log('');
  printClaims(report.claims);
  printReadFirst(report.readFirst);
  if (report.entrypoints.length > 0) printEntrypoints(report.entrypoints);
  if (report.risks.length > 0) printRisks(report.risks);
  printUnknowns(report.unknowns);
  console.log(chalk.bold('Next Commands'));
  for (const command of report.commands.slice(0, 8)) {
    console.log(`- ${command}`);
  }
}

function printClaims(claims: UnderstandClaim[]): void {
  console.log(chalk.bold('Claims'));
  for (const claim of claims.slice(0, 8)) {
    const citations = claim.citations.map((cite) => cite.symbol ? `${cite.file}#${cite.symbol}` : cite.file).join(', ');
    console.log(`- ${claim.title} (${claim.confidence})`);
    console.log(`  ${claim.detail}`);
    console.log(`  evidence: ${citations}`);
  }
  console.log('');
}

function printReadFirst(items: UnderstandReadFirst[]): void {
  console.log(chalk.bold('Read First'));
  for (const item of items.slice(0, 8)) {
    console.log(`- ${item.file}: ${item.why}`);
    console.log(`  run: ${item.command}`);
  }
  console.log('');
}

function printEntrypoints(entrypoints: UnderstandEntrypoint[]): void {
  console.log(chalk.bold('Entrypoints'));
  for (const entry of entrypoints.slice(0, 6)) {
    const symbols = entry.symbols.length > 0 ? ` (${entry.symbols.join(', ')})` : '';
    console.log(`- ${entry.kind}: ${entry.file}${symbols}`);
  }
  console.log('');
}

function printRisks(risks: UnderstandRisk[]): void {
  console.log(chalk.bold('Risks'));
  for (const risk of risks.slice(0, 6)) {
    console.log(`- [${risk.priority}] ${risk.title}: ${risk.command}`);
  }
  console.log('');
}

function printUnknowns(unknowns: UnderstandUnknown[]): void {
  console.log(chalk.bold('Unknowns'));
  if (unknowns.length === 0) {
    console.log('- No major unknowns surfaced by this view.');
    console.log('');
    return;
  }
  for (const unknown of unknowns.slice(0, 6)) {
    console.log(`- ${unknown.question}`);
    console.log(`  ${unknown.whyUnknown}`);
    console.log(`  run: ${unknown.command}`);
  }
  console.log('');
}

function parseView(value: unknown): UnderstandView {
  if (typeof value === 'string' && (VIEWS as readonly string[]).includes(value)) return value as UnderstandView;
  console.error(chalk.red(`Unsupported --view ${String(value)}.`));
  console.error(chalk.dim('Supported views: map, flow, contracts, change, verify'));
  process.exit(1);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
