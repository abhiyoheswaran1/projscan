import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  loadProjectConfig,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { computeDataflow } from '../../core/dataflow.js';
import type { DataflowReport, DataflowRisk } from '../../types.js';

export function registerDataflow(): void {
  program
    .command('dataflow')
    .description('Detect direct, propagated, and bridge source-to-sink dataflow risks')
    .option('--source <name...>', 'add a custom source name (repeatable)')
    .option('--sink <name...>', 'add a custom sink name (repeatable)')
    .option('--max-risks <count>', 'maximum risks to return', parsePositiveInt)
    .option('--include-tests', 'include dataflow risks that touch test files')
    .option('--include-broad-file-io', 'include broad readFile/writeFile-style default risks')
    .action(
      async (cmdOpts: {
        source?: string[];
        sink?: string[];
        maxRisks?: number;
        includeTests?: boolean;
        includeBroadFileIo?: boolean;
      }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('dataflow');

      try {
        const rootPath = getRootPath();
        const config = await loadProjectConfig();
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        const graph = await buildCodeGraph(rootPath, scan.files);
        const sources = [...(config.taint?.sources ?? []), ...(cmdOpts.source ?? [])];
        const sinks = [...(config.taint?.sinks ?? []), ...(cmdOpts.sink ?? [])];
        const maxRisks = Math.max(1, Math.min(500, cmdOpts.maxRisks ?? 50));
        const report = computeDataflow(graph, { sources, sinks }, {
          includeTests: cmdOpts.includeTests === true,
          includeBroadFileIo: cmdOpts.includeBroadFileIo === true,
        });
        const shaped = {
          ...report,
          risks: report.risks.slice(0, maxRisks),
          truncated: report.risks.length > maxRisks || report.truncated,
        };

        if (format === 'json') {
          console.log(JSON.stringify(shaped, null, 2));
          return;
        }
        printDataflow(shaped);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    },
  );
}

function printDataflow(report: DataflowReport): void {
  console.log('');
  console.log(chalk.bold('Dataflow risks'));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (!report.available) {
    console.log(`  ${chalk.yellow('!')} ${report.reason ?? 'unavailable'}`);
    return;
  }
  if (report.riskCount === 0) {
    console.log('  No dataflow risks detected.');
    return;
  }
  console.log(`  ${chalk.bold(report.riskCount)} risk(s) detected:`);
  console.log('');
  for (const risk of report.risks) {
    printRisk(risk);
  }
}

function printRisk(risk: DataflowRisk): void {
  const where = risk.bridgeFn ? `${risk.bridgeFn}: ` : '';
  console.log(`  ${chalk.red('●')} ${where}${chalk.bold(risk.source)} → ${chalk.bold(risk.sink)}`);
  console.log(`    ${chalk.dim('kind:')} ${risk.kind} (${risk.confidence})`);
  console.log(`    ${chalk.dim('path:')} ${risk.path.join(' → ')}`);
  console.log(`    ${chalk.dim('files:')} ${risk.files.join(', ')}`);
  console.log('');
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
