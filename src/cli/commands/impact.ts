import ora from 'ora';
import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph, type CodeGraph } from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import { computeImpact } from '../../core/impact.js';
import { loadWorkspace } from '../../core/workspace.js';
import { reportImpact } from '../../reporters/consoleReporter.js';
import { reportImpactJson } from '../../reporters/jsonReporter.js';
import { reportImpactMarkdown } from '../../reporters/markdownReporter.js';
import { reportImpactHtml } from '../../reporters/htmlReporter.js';

export function registerImpact(): void {
  program
    .command('impact <target>')
    .description('Transitive blast radius for a file (repo path) or symbol (--symbol). Cycle-safe; depth-bounded.')
    .option('--symbol', 'treat <target> as a symbol (export) name instead of a file path')
    .option('--max-distance <n>', 'BFS depth limit (default 10)', (v) => parseInt(v, 10))
    .option(
      '--cross-repo',
      '1.6+: also include callers in sibling repos registered via `projscan workspace add` (symbol mode only)',
    )
    .action(
      async (
        target: string,
        cmdOpts: { symbol?: boolean; maxDistance?: number; crossRepo?: boolean },
      ) => {
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
        const crossRepoGraphs = cmdOpts.crossRepo
          ? await buildCrossRepoGraphs(rootPath)
          : undefined;
        const report = computeImpact(graph, t, {
          ...(cmdOpts.maxDistance ? { maxDistance: cmdOpts.maxDistance } : {}),
          ...(crossRepoGraphs ? { crossRepoGraphs } : {}),
        });

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportImpactJson(report);
            break;
          case 'markdown':
            reportImpactMarkdown(report);
            break;
          case 'html':
            reportImpactHtml(report);
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

async function buildCrossRepoGraphs(rootPath: string): Promise<Map<string, CodeGraph>> {
  const out = new Map<string, CodeGraph>();
  const workspace = await loadWorkspace(rootPath);
  if (!workspace || workspace.repos.length === 0) return out;
  for (const repo of workspace.repos) {
    try {
      const scan = await scanRepository(repo.path);
      out.set(repo.name, await buildCodeGraph(repo.path, scan.files));
    } catch {
      // skip
    }
  }
  return out;
}
