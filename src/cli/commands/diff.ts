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
import { applyConfigToIssues } from '../../utils/config.js';
import { calculateScore } from '../../utils/scoreCalculator.js';
import { saveBaseline, loadBaseline, computeDiff } from '../../utils/baseline.js';
import { reportDiff } from '../../reporters/consoleReporter.js';
import { reportDiffJson } from '../../reporters/jsonReporter.js';
import { reportDiffMarkdown } from '../../reporters/markdownReporter.js';

export function registerDiff(): void {
  program
    .command('diff')
    .description('Compare health against a saved baseline')
    .option('--save-baseline', 'save current health as the baseline')
    .option('--baseline <path>', 'path to baseline file (default: .projscan-baseline.json)')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();

      const config = await loadProjectConfig();
      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        let issues = await collectIssues(rootPath, scan.files);
        issues = applyConfigToIssues(issues, config);
        const hotspotReport = await analyzeHotspots(rootPath, scan.files, issues, { limit: 20 });

        if (cmdOpts.saveBaseline) {
          const filePath = await saveBaseline(rootPath, issues, hotspotReport);
          const { score, grade } = calculateScore(issues);
          console.log(chalk.green(`\n  Baseline saved to ${filePath}`));
          console.log(`  Score: ${chalk.bold(`${grade} (${score}/100)`)}`);
          console.log(`  Issues: ${issues.length}`);
          if (hotspotReport.available) {
            console.log(`  Hotspots snapshotted: ${hotspotReport.hotspots.length}\n`);
          } else {
            console.log('');
          }
          return;
        }

        let baseline;
        try {
          baseline = await loadBaseline(cmdOpts.baseline, rootPath);
        } catch {
          console.error(chalk.yellow('\n  No baseline found.'));
          console.error(`  Run ${chalk.bold.cyan('projscan diff --save-baseline')} first to create one.\n`);
          process.exit(1);
        }

        const diff = computeDiff(baseline, issues, hotspotReport);

        switch (format) {
          case 'json':
            reportDiffJson(diff);
            break;
          case 'markdown':
            reportDiffMarkdown(diff);
            break;
          default:
            reportDiff(diff);
        }
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
