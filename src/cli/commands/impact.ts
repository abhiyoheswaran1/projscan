import ora from 'ora';
import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import { computeImpact } from '../../core/impact.js';
import { reportImpact } from '../../reporters/consoleReporter.js';
import { reportImpactJson } from '../../reporters/jsonReporter.js';
import { reportImpactMarkdown } from '../../reporters/markdownReporter.js';

export function registerImpact(): void {
  program
    .command('impact <target>')
    .description('Transitive blast radius for a file (repo path) or symbol (--symbol). Cycle-safe; depth-bounded.')
    .option('--symbol', 'treat <target> as a symbol (export) name instead of a file path')
    .option('--max-distance <n>', 'BFS depth limit (default 10)', (v) => parseInt(v, 10))
    .action(async (target: string, cmdOpts: { symbol?: boolean; maxDistance?: number }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Computing impact...').start() : null;

      try {
        const scan = await scanRepository(rootPath);
        const cached = await loadCachedGraph(rootPath);
        const graph = await buildCodeGraph(rootPath, scan.files, cached);
        await saveCachedGraph(rootPath, graph);

        const t = cmdOpts.symbol
          ? { kind: 'symbol' as const, value: target }
          : { kind: 'file' as const, value: target };
        const report = computeImpact(graph, t, cmdOpts.maxDistance ? { maxDistance: cmdOpts.maxDistance } : {});

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportImpactJson(report);
            break;
          case 'markdown':
            reportImpactMarkdown(report);
            break;
          default:
            reportImpact(report);
        }

        if (!report.available) process.exitCode = 1;
      } catch (error) {
        if (spinner) spinner.fail('impact failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
