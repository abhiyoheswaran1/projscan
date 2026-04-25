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
import { collectIssues } from '../../core/issueEngine.js';
import { analyzeHotspots } from '../../core/hotspotAnalyzer.js';
import { parseCoverage, coverageMap } from '../../core/coverageParser.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import { applyConfigToIssues } from '../../utils/config.js';
import { reportHotspots } from '../../reporters/consoleReporter.js';
import { reportHotspotsJson } from '../../reporters/jsonReporter.js';
import { reportHotspotsMarkdown } from '../../reporters/markdownReporter.js';

export function registerHotspots(): void {
  program
    .command('hotspots')
    .description('Rank files by risk (git churn × AST cyclomatic complexity × open issues)')
    .option('--limit <n>', 'number of hotspots to show')
    .option('--since <when>', 'git history window (e.g. "6 months ago", "2024-01-01")')
    .option('--package <name>', 'monorepo: scope to a single workspace package')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const config = await loadProjectConfig();
      const spinner = format === 'console' ? ora('Analyzing hotspots...').start() : null;

      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        let issues = await collectIssues(rootPath, scan.files);
        issues = applyConfigToIssues(issues, config);
        const limitRaw = cmdOpts.limit ?? config.hotspots?.limit ?? 10;
        const limit = Math.max(
          1,
          Math.min(100, typeof limitRaw === 'string' ? parseInt(limitRaw, 10) || 10 : limitRaw),
        );
        const since = cmdOpts.since ?? config.hotspots?.since ?? '12 months ago';
        const coverageReport = await parseCoverage(rootPath);
        // Build the code graph so the risk score uses AST cyclomatic complexity
        // instead of LOC. Cache hit makes this nearly free on repeat runs.
        const cached = await loadCachedGraph(rootPath);
        const graph = await buildCodeGraph(rootPath, scan.files, cached);
        await saveCachedGraph(rootPath, graph);
        const report = await analyzeHotspots(rootPath, scan.files, issues, {
          since,
          limit,
          coverage: coverageReport.available ? coverageMap(coverageReport) : undefined,
          graph,
        });

        if (cmdOpts.package) {
          const ws = await detectWorkspaces(rootPath);
          const allowed = new Set(filterFilesByPackage(ws, cmdOpts.package, report.hotspots.map((h) => h.relativePath)));
          report.hotspots = report.hotspots.filter((h) => allowed.has(h.relativePath));
        }

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportHotspotsJson(report);
            break;
          case 'markdown':
            reportHotspotsMarkdown(report);
            break;
          default:
            reportHotspots(report);
        }
      } catch (error) {
        if (spinner) spinner.fail('Hotspot analysis failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
