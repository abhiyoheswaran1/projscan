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
import { joinCoverageWithHotspots } from '../../core/coverageJoin.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import { reportCoverage } from '../../reporters/consoleReporter.js';
import { reportCoverageJson } from '../../reporters/jsonReporter.js';
import { reportCoverageMarkdown } from '../../reporters/markdownReporter.js';

export function registerCoverage(): void {
  program
    .command('coverage')
    .description('Join test coverage with hotspots - surface the scariest untested files')
    .option('--limit <n>', 'limit number of entries shown', '30')
    .option('--package <name>', 'monorepo: scope to a single workspace package')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const config = await loadProjectConfig();
      const spinner = format === 'console' ? ora('Parsing coverage...').start() : null;

      try {
        const coverage = await parseCoverage(rootPath);
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        const issues = await collectIssues(rootPath, scan.files);
        const limitRaw = cmdOpts.limit ?? 30;
        const limit = Math.max(1, Math.min(200, typeof limitRaw === 'string' ? parseInt(limitRaw, 10) || 30 : limitRaw));
        const hotspots = await analyzeHotspots(rootPath, scan.files, issues, {
          limit,
          coverage: coverage.available ? coverageMap(coverage) : undefined,
        });

        const joined = joinCoverageWithHotspots(hotspots, coverage);
        if (cmdOpts.package && joined.available) {
          const ws = await detectWorkspaces(rootPath);
          const allowed = new Set(filterFilesByPackage(ws, cmdOpts.package, joined.entries.map((e) => e.relativePath)));
          joined.entries = joined.entries.filter((e) => allowed.has(e.relativePath));
        }

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportCoverageJson(joined);
            break;
          case 'markdown':
            reportCoverageMarkdown(joined);
            break;
          default:
            reportCoverage(joined);
        }
      } catch (error) {
        if (spinner) spinner.fail('Coverage analysis failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
