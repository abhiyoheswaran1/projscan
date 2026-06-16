import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';

import {
  program,
  pkg,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeBanner,
  filterIssuesByChangedFiles,
  renderPluginReporterIfRequested,
  assertFormatSupported,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { detectLanguages } from '../../core/languageDetector.js';
import { detectFrameworks } from '../../core/frameworkDetector.js';
import { analyzeDependencies } from '../../core/dependencyAnalyzer.js';
import { collectIssues } from '../../core/issueEngine.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import {
  applyReportControlsToAnalysis,
  reportControlsMetadata,
  resolveReportControls,
} from '../../core/reportScope.js';
import { applyConfigToIssues } from '../../utils/config.js';
import { reportAnalysis } from '../../reporters/consoleReporter.js';
import { reportAnalysisJson } from '../../reporters/jsonReporter.js';
import { reportAnalysisMarkdown } from '../../reporters/markdownReporter.js';
import { reportAnalysisSarif } from '../../reporters/sarifReporter.js';
import { reportAnalysisHtml } from '../../reporters/htmlReporter.js';
import type { AnalysisReport } from '../../types.js';

export function registerAnalyze(): void {
  program
    .command('analyze', { isDefault: true })
    .description('Analyze repository and show project report')
    .option('--changed-only', 'only report issues on files changed vs base ref')
    .option('--base-ref <ref>', 'git base ref for --changed-only (default: origin/main)')
    .option('--package <name>', 'monorepo: scope issues to a single workspace package')
    .option('--report-policy <name>', 'use a named report policy preset from config')
    .option('--report-scope <paths>', 'comma-separated repo-relative paths to include in exported evidence')
    .option('--redact-paths', 'replace file paths in exported evidence with stable redacted labels')
    .option('--reporter <name>', 'render output with a local reporter plugin')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeBanner();
      const rootPath = getRootPath();
      const format = assertFormatSupported('analyze');
      const config = await loadProjectConfig();
      const spinner = format === 'console' ? ora('Scanning repository...').start() : null;

      try {
        const reportControls = resolveReportControls({
          reportPolicies: config.reportPolicies,
          reportPolicy: cmdOpts.reportPolicy,
          reportScope: cmdOpts.reportScope,
          redactPaths: cmdOpts.redactPaths,
        });
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        if (spinner) spinner.text = 'Detecting languages...';
        const languages = detectLanguages(scan.files);

        if (spinner) spinner.text = 'Detecting frameworks...';
        const frameworks = await detectFrameworks(rootPath, scan.files);

        if (spinner) spinner.text = 'Analyzing dependencies...';
        const dependencies = await analyzeDependencies(rootPath);

        if (spinner) spinner.text = 'Checking for issues...';
        let issues = await collectIssues(rootPath, scan.files);
        issues = applyConfigToIssues(issues, config);
        if (cmdOpts.changedOnly) {
          issues = await filterIssuesByChangedFiles(
            issues,
            rootPath,
            cmdOpts.baseRef ?? config.baseRef,
          );
        }
        if (cmdOpts.package) {
          const ws = await detectWorkspaces(rootPath);
          const allowed = new Set(
            filterFilesByPackage(
              ws,
              cmdOpts.package,
              scan.files.map((f) => f.relativePath),
            ),
          );
          issues = issues.filter((i) =>
            (i.locations ?? []).some((l) => l.file && allowed.has(l.file)),
          );
        }

        if (spinner) spinner.stop();

        const report: AnalysisReport = applyReportControlsToAnalysis(
          {
            projectName: path.basename(rootPath),
            rootPath,
            scan,
            languages,
            frameworks,
            dependencies,
            issues,
            timestamp: new Date().toISOString(),
          },
          reportControls,
        );
        const reportControlsInfo = reportControlsMetadata(reportControls);

        if (await renderPluginReporterIfRequested('analyze', cmdOpts.reporter, report)) return;

        switch (format) {
          case 'json':
            reportAnalysisJson(report, reportControlsInfo);
            break;
          case 'markdown':
            reportAnalysisMarkdown(report, reportControlsInfo);
            break;
          case 'sarif':
            reportAnalysisSarif(report.issues, pkg.version, reportControlsInfo);
            break;
          case 'html':
            reportAnalysisHtml(report, reportControlsInfo);
            break;
          default:
            reportAnalysis(report);
        }
      } catch (error) {
        if (spinner) spinner.fail('Analysis failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
