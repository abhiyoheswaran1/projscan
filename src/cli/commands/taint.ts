import chalk from 'chalk';

import {
  program,
  getFormat,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { computeTaint, type TaintReport } from '../../core/taint.js';

/**
 * `projscan taint` (1.6+) — surface source-to-sink reachability flows.
 * Mirrors `projscan_taint` MCP tool. Default output is human-readable;
 * `--format json` returns the raw TaintReport.
 */
export function registerTaint(): void {
  program
    .command('taint')
    .description('Source-to-sink reachability over the call graph (1.6+)')
    .option('--source <name...>', 'add a custom source name (repeatable)')
    .option('--sink <name...>', 'add a custom sink name (repeatable)')
    .option('--limit <n>', 'cap flows shown', '50')
    .action(async (opts: { source?: string[]; sink?: string[]; limit?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      try {
        const config = await loadProjectConfig();
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        const graph = await buildCodeGraph(rootPath, scan.files);
        const sources = [...(config.taint?.sources ?? []), ...(opts.source ?? [])];
        const sinks = [...(config.taint?.sinks ?? []), ...(opts.sink ?? [])];
        const limit = Math.max(1, Math.min(500, parseInt(opts.limit ?? '50', 10) || 50));
        const report = computeTaint(graph, { sources, sinks });

        if (format === 'json') {
          console.log(
            JSON.stringify(
              {
                ...report,
                flows: report.flows.slice(0, limit),
                truncated: report.flows.length > limit,
              },
              null,
              2,
            ),
          );
          return;
        }

        renderTaint(report, limit);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

function renderTaint(report: TaintReport, limit: number): void {
  console.log('');
  console.log(chalk.bold('Taint flows'));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (!report.available) {
    console.log(`  ${chalk.yellow('!')} ${report.reason ?? 'unavailable'}`);
    return;
  }
  if (report.flowCount === 0) {
    console.log('  No source-to-sink flows detected.');
    console.log(
      chalk.dim(
        `  Effective sources: ${report.effectiveSources.length}; sinks: ${report.effectiveSinks.length}.`,
      ),
    );
    return;
  }
  console.log(`  ${chalk.bold(report.flowCount)} flow(s) detected:`);
  console.log('');
  const shown = report.flows.slice(0, limit);
  for (const flow of shown) {
    const arrow = flow.path.length === 1 ? '(direct)' : flow.path.join(' → ');
    console.log(`  ${chalk.red('●')} ${chalk.bold(flow.source)} → ${chalk.bold(flow.sink)}`);
    console.log(`    ${chalk.dim('path:')} ${arrow}`);
    console.log(`    ${chalk.dim('files:')} ${flow.files.join(', ')}`);
    console.log('');
  }
  if (report.flowCount > limit) {
    console.log(chalk.dim(`  …and ${report.flowCount - limit} more (raise --limit to see them).`));
  }
}
