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
import { buildSemanticGraph } from '../../core/semanticGraph.js';
import type { SemanticGraphReport } from '../../types.js';

export function registerSemanticGraph(): void {
  program
    .command('semantic-graph')
    .description('Render the stable v3 semantic graph for agents and automation')
    .option('--max-nodes <count>', 'maximum graph nodes to return', parsePositiveInt)
    .option('--max-edges <count>', 'maximum graph edges to return', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('semantic-graph');

      try {
        const rootPath = getRootPath();
        const config = await loadProjectConfig();
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        const graph = await buildCodeGraph(rootPath, scan.files);
        const report = buildSemanticGraph(graph, {
          maxNodes: cmdOpts.maxNodes,
          maxEdges: cmdOpts.maxEdges,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printSemanticGraph(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printSemanticGraph(report: SemanticGraphReport): void {
  console.log('');
  console.log(chalk.bold('Semantic graph'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(`  Schema:    v${report.schemaVersion}`);
  console.log(`  Files:     ${report.metrics.totalFiles}`);
  console.log(`  Functions: ${report.metrics.totalFunctions}`);
  console.log(`  Packages:  ${report.metrics.totalPackages}`);
  console.log(`  Nodes:     ${report.nodes.length}${report.truncated ? ' (truncated)' : ''}`);
  console.log(`  Edges:     ${report.edges.length}`);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
