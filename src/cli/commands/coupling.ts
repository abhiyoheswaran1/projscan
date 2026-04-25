import ora from 'ora';
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
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import { computeCoupling, filterCoupling } from '../../core/couplingAnalyzer.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import { reportCoupling } from '../../reporters/consoleReporter.js';
import { reportCouplingJson } from '../../reporters/jsonReporter.js';
import { reportCouplingMarkdown } from '../../reporters/markdownReporter.js';

export function registerCoupling(): void {
  program
    .command('coupling')
    .description('Per-file fan-in / fan-out / instability and circular-import cycles (AST-derived)')
    .option('--limit <n>', 'number of files to show (default 25)')
    .option('--cycles-only', 'only show files participating in import cycles')
    .option('--high-fan-in', 'sort by fan-in (most-depended-on first)')
    .option('--high-fan-out', 'sort by fan-out (most-coupled first)')
    .option('--file <path>', 'restrict output to a single file')
    .option('--package <name>', 'monorepo: scope to a single workspace package')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const config = await loadProjectConfig();
      const spinner = format === 'console' ? ora('Computing coupling + cycles...').start() : null;

      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        const cached = await loadCachedGraph(rootPath);
        const graph = await buildCodeGraph(rootPath, scan.files, cached);
        await saveCachedGraph(rootPath, graph);
        const ws = await detectWorkspaces(rootPath);
        const report = computeCoupling(graph, ws);

        const direction: 'all' | 'high_fan_in' | 'high_fan_out' | 'cycles_only' = cmdOpts.cyclesOnly
          ? 'cycles_only'
          : cmdOpts.highFanIn
            ? 'high_fan_in'
            : cmdOpts.highFanOut
              ? 'high_fan_out'
              : 'all';
        const limitRaw = cmdOpts.limit ?? 25;
        const limit = Math.max(
          1,
          Math.min(500, typeof limitRaw === 'string' ? parseInt(limitRaw, 10) || 25 : limitRaw),
        );
        let files = filterCoupling(report, direction);
        if (cmdOpts.file) files = files.filter((f) => f.relativePath === cmdOpts.file);
        if (cmdOpts.package) {
          const ws2 = await detectWorkspaces(rootPath);
          const allowed = new Set(filterFilesByPackage(ws2, cmdOpts.package, files.map((f) => f.relativePath)));
          files = files.filter((f) => allowed.has(f.relativePath));
        }
        files = files.slice(0, limit);

        const filtered = {
          files,
          cycles: report.cycles,
          crossPackageEdges: report.crossPackageEdges,
          totalFiles: report.totalFiles,
          totalCycles: report.totalCycles,
          totalCrossPackageEdges: report.totalCrossPackageEdges,
        };

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportCouplingJson(filtered);
            break;
          case 'markdown':
            reportCouplingMarkdown(filtered);
            break;
          default:
            reportCoupling(filtered);
        }
      } catch (error) {
        if (spinner) spinner.fail('Coupling analysis failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

