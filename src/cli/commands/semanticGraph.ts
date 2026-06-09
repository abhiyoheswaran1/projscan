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
import { runGraphQuery, type GraphQueryDirection } from '../../core/graphQuery.js';
import type { SemanticGraphReport } from '../../types.js';

const GRAPH_QUERY_DIRECTIONS = new Set<GraphQueryDirection>([
  'imports',
  'exports',
  'importers',
  'symbol_defs',
  'package_importers',
]);

export function registerSemanticGraph(): void {
  program
    .command('semantic-graph')
    .description('Render the stable v3 semantic graph for agents and automation')
    .option('--max-nodes <count>', 'maximum graph nodes to return', parsePositiveInt)
    .option('--max-edges <count>', 'maximum graph edges to return', parsePositiveInt)
    .option('--query <direction>', 'targeted query: imports | exports | importers | symbol_defs | package_importers', parseGraphQueryDirection)
    .option('--file <path>', 'repo-relative file path for imports / exports / importers queries')
    .option('--symbol <name>', 'symbol or package name for symbol_defs / package_importers queries')
    .option('--limit <count>', 'maximum targeted query entries to return', parsePositiveInt)
    .action(async (cmdOpts: {
      maxNodes?: number;
      maxEdges?: number;
      query?: GraphQueryDirection;
      file?: string;
      symbol?: string;
      limit?: number;
    }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('semantic-graph');

      try {
        const rootPath = getRootPath();
        const config = await loadProjectConfig();
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        const graph = await buildCodeGraph(rootPath, scan.files);
        if (cmdOpts.query) {
          const result = runGraphQuery(graph, {
            direction: cmdOpts.query,
            file: cmdOpts.file,
            symbol: cmdOpts.symbol,
            limit: cmdOpts.limit,
          });
          console.log(JSON.stringify(result, null, 2));
          return;
        }

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

function parseGraphQueryDirection(value: string): GraphQueryDirection {
  if (GRAPH_QUERY_DIRECTIONS.has(value as GraphQueryDirection)) return value as GraphQueryDirection;
  throw new Error(`unknown query direction "${value}". Valid: ${[...GRAPH_QUERY_DIRECTIONS].join(', ')}`);
}
