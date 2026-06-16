import chalk from 'chalk';

import {
  program,
  pkg,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
  filterIssuesByChangedFiles,
  renderPluginReporterIfRequested,
  assertFormatSupported,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import {
  applyReportControlsToIssues,
  reportControlsMetadata,
  resolveReportControls,
} from '../../core/reportScope.js';
import { applyConfigToIssues } from '../../utils/config.js';
import { calculateScore } from '../../utils/scoreCalculator.js';
import { reportCi } from '../../reporters/consoleReporter.js';
import { reportCiJson } from '../../reporters/jsonReporter.js';
import { reportCiMarkdown } from '../../reporters/markdownReporter.js';
import { reportCiSarif } from '../../reporters/sarifReporter.js';

export function registerCi(): void {
  program
    .command('ci')
    .description('Run health check for CI pipelines (exits 1 if score below threshold)')
    .option('--min-score <score>', 'minimum passing score (0-100)')
    .option('--changed-only', 'gate only on issues in files changed vs base ref')
    .option('--base-ref <ref>', 'git base ref for --changed-only (default: origin/main)')
    .option('--report-policy <name>', 'use a named report policy preset from config')
    .option('--report-scope <paths>', 'comma-separated repo-relative paths to include in exported evidence')
    .option('--redact-paths', 'replace file paths in exported evidence with stable redacted labels')
    .option('--reporter <name>', 'render output with a local reporter plugin')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = assertFormatSupported('ci');
      const config = await loadProjectConfig();

      try {
        const reportControls = resolveReportControls({
          reportPolicies: config.reportPolicies,
          reportPolicy: cmdOpts.reportPolicy,
          reportScope: cmdOpts.reportScope,
          redactPaths: cmdOpts.redactPaths,
        });
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        let issues = await collectIssues(rootPath, scan.files);
        issues = applyConfigToIssues(issues, config);
        if (cmdOpts.changedOnly) {
          issues = await filterIssuesByChangedFiles(
            issues,
            rootPath,
            cmdOpts.baseRef ?? config.baseRef,
          );
        }
        issues = applyReportControlsToIssues(issues, reportControls);
        const reportControlsInfo = reportControlsMetadata(reportControls);

        const rawThreshold = cmdOpts.minScore ?? config.minScore ?? 70;
        const threshold = Math.max(
          0,
          Math.min(
            100,
            typeof rawThreshold === 'string' ? parseInt(rawThreshold, 10) || 70 : rawThreshold,
          ),
        );
        const { score, grade, errors, warnings, infos } = calculateScore(issues);
        const ci = {
          score,
          grade,
          pass: score >= threshold,
          threshold,
          totalIssues: issues.length,
          errors,
          warnings,
          info: infos,
          issues,
        };

        if (await renderPluginReporterIfRequested('ci', cmdOpts.reporter, { ci })) {
          if (score < threshold) process.exit(1);
          return;
        }

        switch (format) {
          case 'json':
            reportCiJson(issues, threshold, reportControlsInfo);
            break;
          case 'markdown':
            reportCiMarkdown(issues, threshold, reportControlsInfo);
            break;
          case 'sarif':
            reportCiSarif(issues, pkg.version, reportControlsInfo);
            break;
          default:
            reportCi(issues, threshold);
        }

        if (score < threshold) {
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
