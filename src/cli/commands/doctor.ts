import ora from 'ora';
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
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import {
  applyReportControlsToIssues,
  reportControlsMetadata,
  resolveReportControls,
} from '../../core/reportScope.js';
import { applyConfigToIssues } from '../../utils/config.js';
import { reportHealth } from '../../reporters/consoleReporter.js';
import { reportHealthJson } from '../../reporters/jsonReporter.js';
import { reportHealthMarkdown } from '../../reporters/markdownReporter.js';
import { reportHealthSarif } from '../../reporters/sarifReporter.js';
import { reportHealthHtml } from '../../reporters/htmlReporter.js';
import { findStableRules, loadMemory } from '../../core/memory.js';
import { calculateScore } from '../../utils/scoreCalculator.js';

export function registerDoctor(): void {
  program
    .command('doctor')
    .description('Evaluate project health and detect issues')
    .option('--changed-only', 'only report issues on files changed vs base ref')
    .option('--base-ref <ref>', 'git base ref for --changed-only (default: origin/main)')
    .option('--package <name>', 'monorepo: scope issues to a single workspace package')
    .option('--report-policy <name>', 'use a named report policy preset from config')
    .option('--report-scope <paths>', 'comma-separated repo-relative paths to include in exported evidence')
    .option('--redact-paths', 'replace file paths in exported evidence with stable redacted labels')
    .option('--reporter <name>', 'render output with a local reporter plugin')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = assertFormatSupported('doctor');
      const config = await loadProjectConfig();
      const spinner = format === 'console' ? ora('Running health checks...').start() : null;

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
        issues = applyReportControlsToIssues(issues, reportControls);
        const reportControlsInfo = reportControlsMetadata(reportControls);

        if (spinner) spinner.stop();

        const health = calculateScore(issues);
        if (await renderPluginReporterIfRequested('doctor', cmdOpts.reporter, { health, issues }))
          return;

        switch (format) {
          case 'json':
            reportHealthJson(issues, reportControlsInfo);
            break;
          case 'markdown':
            reportHealthMarkdown(issues);
            break;
          case 'sarif':
            reportHealthSarif(issues, pkg.version, reportControlsInfo);
            break;
          case 'html':
            reportHealthHtml(issues);
            break;
          default: {
            // 1.5+ — surface a Project Memory tip when stable rules
            // have accumulated. Best-effort: a memory load failure
            // never blocks the doctor output.
            let stableRuleCount = 0;
            try {
              const memory = await loadMemory(rootPath);
              stableRuleCount = findStableRules(memory).length;
            } catch {
              // best-effort
            }
            reportHealth(issues, {
              scanTimeMs: scan.scanDurationMs,
              stableRuleCount,
            });
          }
        }
      } catch (error) {
        if (spinner) spinner.fail('Health check failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
