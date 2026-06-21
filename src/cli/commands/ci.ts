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
import { evaluateCiGate } from '../../core/ciGate.js';
import { applyConfigToIssues } from '../../utils/config.js';
import { DEFAULT_CI_FAIL_ON, normalizeCiFailOn } from '../../utils/ciFailOn.js';
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
    .option(
      '--fail-on <severity>',
      'lowest severity that can fail a below-threshold CI gate (info, warning, or error)',
    )
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
        const cliFailOn = failOnFromCli(cmdOpts.failOn);
        const failOn = cliFailOn ?? config.failOn ?? DEFAULT_CI_FAIL_ON;
        const gate = evaluateCiGate(issues, threshold, failOn);
        const ci = {
          score: gate.score,
          grade: gate.grade,
          pass: gate.pass,
          threshold,
          failOn: gate.failOn,
          scorePass: gate.scorePass,
          severityFloorMet: gate.severityFloorMet,
          totalIssues: issues.length,
          errors: gate.errors,
          warnings: gate.warnings,
          info: gate.infos,
          scoreBreakdown: gate.scoreBreakdown,
          issues,
        };

        if (await renderPluginReporterIfRequested('ci', cmdOpts.reporter, { ci })) {
          if (!ci.pass) process.exit(1);
          return;
        }

        switch (format) {
          case 'json':
            reportCiJson(issues, threshold, reportControlsInfo, failOn);
            break;
          case 'markdown':
            reportCiMarkdown(issues, threshold, reportControlsInfo, failOn);
            break;
          case 'sarif':
            reportCiSarif(issues, pkg.version, reportControlsInfo);
            break;
          default:
            reportCi(issues, threshold, failOn);
        }

        if (!ci.pass) {
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

function failOnFromCli(value: unknown) {
  if (value === undefined) return undefined;
  const failOn = normalizeCiFailOn(value);
  if (!failOn) throw new Error('--fail-on must be one of: info, warning, error');
  return failOn;
}
