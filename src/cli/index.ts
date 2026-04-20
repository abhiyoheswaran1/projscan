#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));

import { scanRepository } from '../core/repositoryScanner.js';
import { detectLanguages } from '../core/languageDetector.js';
import { detectFrameworks } from '../core/frameworkDetector.js';
import { analyzeDependencies } from '../core/dependencyAnalyzer.js';
import { collectIssues } from '../core/issueEngine.js';
import { analyzeHotspots } from '../core/hotspotAnalyzer.js';
import { detectOutdated } from '../core/outdatedDetector.js';
import { runAudit, auditFindingsToIssues } from '../core/auditRunner.js';
import { previewUpgrade } from '../core/upgradePreview.js';
import { parseCoverage, coverageMap } from '../core/coverageParser.js';
import { joinCoverageWithHotspots } from '../core/coverageJoin.js';
import {
  inspectFile,
  extractImports,
  extractExports,
  inferPurpose,
  detectFileIssues,
} from '../core/fileInspector.js';
import { getAllAvailableFixes } from '../fixes/fixRegistry.js';
import { setLogLevel } from '../utils/logger.js';
import { calculateScore, badgeUrl, badgeMarkdown } from '../utils/scoreCalculator.js';
import { showBanner, showCompactBanner, showHelp } from '../utils/banner.js';
import { saveBaseline, loadBaseline, computeDiff } from '../utils/baseline.js';
import { loadConfig, applyConfigToIssues } from '../utils/config.js';
import { getChangedFiles } from '../utils/changedFiles.js';
import { runMcpServer } from '../mcp/server.js';

import {
  reportAnalysis,
  reportHealth,
  reportCi,
  reportDiff,
  reportDetectedIssues,
  reportExplanation,
  reportDiagram,
  reportStructure,
  reportDependencies,
  reportHotspots,
  reportFileInspection,
  reportOutdated,
  reportAudit,
  reportUpgrade,
  reportCoverage,
} from '../reporters/consoleReporter.js';

import {
  reportAnalysisJson,
  reportHealthJson,
  reportCiJson,
  reportDiffJson,
  reportExplanationJson,
  reportDiagramJson,
  reportStructureJson,
  reportDependenciesJson,
  reportHotspotsJson,
  reportFileJson,
  reportOutdatedJson,
  reportAuditJson,
  reportUpgradeJson,
  reportCoverageJson,
} from '../reporters/jsonReporter.js';

import {
  reportAnalysisMarkdown,
  reportHealthMarkdown,
  reportCiMarkdown,
  reportDiffMarkdown,
  reportExplanationMarkdown,
  reportDiagramMarkdown,
  reportStructureMarkdown,
  reportDependenciesMarkdown,
  reportHotspotsMarkdown,
  reportFileMarkdown,
  reportOutdatedMarkdown,
  reportAuditMarkdown,
  reportUpgradeMarkdown,
  reportCoverageMarkdown,
} from '../reporters/markdownReporter.js';

import {
  reportAnalysisSarif,
  reportHealthSarif,
  reportCiSarif,
  issuesToSarif,
} from '../reporters/sarifReporter.js';

import type {
  AnalysisReport,
  FileExplanation,
  ArchitectureLayer,
  ReportFormat,
  FixResult,
  Issue,
  ProjscanConfig,
} from '../types.js';

// ── CLI Setup ─────────────────────────────────────────────

const program = new Command();

program
  .name('projscan')
  .description('Instant codebase insights — doctor, x-ray, and architecture map for any repository')
  .version(pkg.version)
  .option('--format <type>', 'output format: console, json, markdown, sarif', 'console')
  .option('--config <path>', 'path to .projscanrc config file')
  .option('--verbose', 'enable verbose output')
  .option('--quiet', 'suppress non-essential output');

function getFormat(): ReportFormat {
  const opts = program.opts();
  const f = opts.format as string;
  if (f === 'json' || f === 'markdown' || f === 'sarif') return f;
  return 'console';
}

function getRootPath(): string {
  return process.cwd();
}

async function loadProjectConfig(): Promise<ProjscanConfig> {
  const opts = program.opts();
  const explicit = typeof opts.config === 'string' ? (opts.config as string) : undefined;
  try {
    const { config, source } = await loadConfig(getRootPath(), explicit);
    if (source && !opts.quiet && getFormat() === 'console') {
      console.error(chalk.dim(`  [config: ${path.relative(getRootPath(), source) || source}]`));
    }
    return config;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`  Config error: ${msg}`));
    process.exit(1);
  }
}

async function filterIssuesByChangedFiles(
  issues: Issue[],
  rootPath: string,
  baseRef?: string,
): Promise<Issue[]> {
  const result = await getChangedFiles(rootPath, baseRef);
  if (!result.available) {
    if (getFormat() === 'console' && !program.opts().quiet) {
      console.error(chalk.yellow(`  [--changed-only: ${result.reason ?? 'unavailable'} — reporting all issues]`));
    }
    return issues;
  }
  if (getFormat() === 'console' && !program.opts().quiet) {
    console.error(chalk.dim(`  [--changed-only: base=${result.baseRef}, ${result.files.length} file(s)]`));
  }
  const set = new Set(result.files);
  return issues.filter((issue) => {
    if (!issue.locations || issue.locations.length === 0) return false;
    return issue.locations.some((loc) => set.has(loc.file));
  });
}

function setupLogLevel(): void {
  const opts = program.opts();
  if (opts.verbose) setLogLevel('debug');
  else if (opts.quiet) setLogLevel('quiet');
}

function maybeBanner(): void {
  const opts = program.opts();
  if (!opts.quiet && getFormat() === 'console') {
    try {
      showBanner();
    } catch (err) {
      console.error(chalk.dim(`  [banner error: ${err instanceof Error ? err.message : String(err)}]`));
    }
  }
}

function maybeCompactBanner(): void {
  const opts = program.opts();
  if (!opts.quiet && getFormat() === 'console') {
    try {
      showCompactBanner();
    } catch (err) {
      console.error(chalk.dim(`  [banner error: ${err instanceof Error ? err.message : String(err)}]`));
    }
  }
}

// ── Command: analyze (default) ────────────────────────────

program
  .command('analyze', { isDefault: true })
  .description('Analyze repository and show project report')
  .option('--changed-only', 'only report issues on files changed vs base ref')
  .option('--base-ref <ref>', 'git base ref for --changed-only (default: origin/main)')
  .action(async (cmdOpts) => {
    setupLogLevel();
    maybeBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const config = await loadProjectConfig();
    const spinner = format === 'console' ? ora('Scanning repository...').start() : null;

    try {
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
        issues = await filterIssuesByChangedFiles(issues, rootPath, cmdOpts.baseRef ?? config.baseRef);
      }

      if (spinner) spinner.stop();

      const report: AnalysisReport = {
        projectName: path.basename(rootPath),
        rootPath,
        scan,
        languages,
        frameworks,
        dependencies,
        issues,
        timestamp: new Date().toISOString(),
      };

      switch (format) {
        case 'json':
          reportAnalysisJson(report);
          break;
        case 'markdown':
          reportAnalysisMarkdown(report);
          break;
        case 'sarif':
          reportAnalysisSarif(issues, pkg.version);
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

// ── Command: doctor ───────────────────────────────────────

program
  .command('doctor')
  .description('Evaluate project health and detect issues')
  .option('--changed-only', 'only report issues on files changed vs base ref')
  .option('--base-ref <ref>', 'git base ref for --changed-only (default: origin/main)')
  .action(async (cmdOpts) => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const config = await loadProjectConfig();
    const spinner = format === 'console' ? ora('Running health checks...').start() : null;

    try {
      const scan = await scanRepository(rootPath, { ignore: config.ignore });
      let issues = await collectIssues(rootPath, scan.files);
      issues = applyConfigToIssues(issues, config);
      if (cmdOpts.changedOnly) {
        issues = await filterIssuesByChangedFiles(issues, rootPath, cmdOpts.baseRef ?? config.baseRef);
      }

      if (spinner) spinner.stop();

      switch (format) {
        case 'json':
          reportHealthJson(issues);
          break;
        case 'markdown':
          reportHealthMarkdown(issues);
          break;
        case 'sarif':
          reportHealthSarif(issues, pkg.version);
          break;
        default:
          reportHealth(issues, scan.scanDurationMs);
      }
    } catch (error) {
      if (spinner) spinner.fail('Health check failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: ci ──────────────────────────────────────────

program
  .command('ci')
  .description('Run health check for CI pipelines (exits 1 if score below threshold)')
  .option('--min-score <score>', 'minimum passing score (0-100)')
  .option('--changed-only', 'gate only on issues in files changed vs base ref')
  .option('--base-ref <ref>', 'git base ref for --changed-only (default: origin/main)')
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
      if (cmdOpts.changedOnly) {
        issues = await filterIssuesByChangedFiles(issues, rootPath, cmdOpts.baseRef ?? config.baseRef);
      }

      const rawThreshold = cmdOpts.minScore ?? config.minScore ?? 70;
      const threshold = Math.max(
        0,
        Math.min(100, typeof rawThreshold === 'string' ? parseInt(rawThreshold, 10) || 70 : rawThreshold),
      );
      const { score } = calculateScore(issues);

      switch (format) {
        case 'json':
          reportCiJson(issues, threshold);
          break;
        case 'markdown':
          reportCiMarkdown(issues, threshold);
          break;
        case 'sarif':
          reportCiSarif(issues, pkg.version);
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

// ── Command: diff ─────────────────────────────────────────

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

// ── Command: fix ──────────────────────────────────────────

program
  .command('fix')
  .description('Auto-fix detected project issues')
  .option('-y, --yes', 'apply fixes without prompting')
  .action(async (cmdOpts) => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const spinner = ora('Detecting issues...').start();
    const config = await loadProjectConfig();

    try {
      const scan = await scanRepository(rootPath, { ignore: config.ignore });
      let issues = await collectIssues(rootPath, scan.files);
      issues = applyConfigToIssues(issues, config);
      const fixes = getAllAvailableFixes(issues);

      spinner.stop();

      if (fixes.length === 0) {
        console.log(`\n  ${chalk.green('✓')} ${chalk.bold('No fixable issues found!')}\n`);
        return;
      }

      reportDetectedIssues(issues, fixes);

      // Prompt for confirmation
      if (!cmdOpts.yes) {
        const proceed = await promptYesNo(`  Apply ${fixes.length} fix${fixes.length > 1 ? 'es' : ''}? (y/n) `);
        if (!proceed) {
          console.log(chalk.dim('\n  Aborted.\n'));
          return;
        }
      }

      // Apply fixes
      const results: FixResult[] = [];
      for (const fix of fixes) {
        const fixSpinner = ora(`  Applying: ${fix.title}...`).start();
        try {
          await fix.apply(rootPath);
          fixSpinner.succeed(`  ${fix.title}`);
          results.push({ fix, success: true });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          fixSpinner.fail(`  ${fix.title}`);
          results.push({ fix, success: false, error: msg });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      console.log('');
      if (succeeded > 0) {
        console.log(`  ${chalk.green('✓')} ${succeeded} fix${succeeded > 1 ? 'es' : ''} applied successfully`);
      }
      if (failed > 0) {
        console.log(`  ${chalk.red('✗')} ${failed} fix${failed > 1 ? 'es' : ''} failed`);
      }
      console.log('');
    } catch (error) {
      spinner.fail('Fix detection failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: file ─────────────────────────────────────────

program
  .command('file <file>')
  .description('Drill into a file — purpose, risk, ownership, related issues')
  .action(async (filePath: string) => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const spinner = format === 'console' ? ora('Inspecting file...').start() : null;

    try {
      const inspection = await inspectFile(rootPath, filePath);
      if (spinner) spinner.stop();

      if (!inspection.exists) {
        console.error(chalk.red(`\n  ${inspection.reason ?? 'File unavailable'}: ${filePath}\n`));
        process.exit(1);
      }

      switch (format) {
        case 'json':
          reportFileJson(inspection);
          break;
        case 'markdown':
          reportFileMarkdown(inspection);
          break;
        default:
          reportFileInspection(inspection);
      }
    } catch (error) {
      if (spinner) spinner.fail('File inspection failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: explain ──────────────────────────────────────

program
  .command('explain <file>')
  .description('Explain a file — its purpose, dependencies, and exports')
  .action(async (filePath: string) => {
    setupLogLevel();
    maybeCompactBanner();
    const format = getFormat();
    const absolutePath = path.resolve(filePath);

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const explanation = analyzeFile(absolutePath, content);

      switch (format) {
        case 'json':
          reportExplanationJson(explanation);
          break;
        case 'markdown':
          reportExplanationMarkdown(explanation);
          break;
        default:
          reportExplanation(explanation);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(chalk.red(`File not found: ${filePath}`));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  });

// ── Command: diagram ──────────────────────────────────────

program
  .command('diagram')
  .description('Generate architecture overview diagram')
  .action(async () => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const config = await loadProjectConfig();
    const spinner = format === 'console' ? ora('Analyzing architecture...').start() : null;

    try {
      const scan = await scanRepository(rootPath, { ignore: config.ignore });
      const frameworks = await detectFrameworks(rootPath, scan.files);
      const layers = buildArchitectureLayers(scan.files, frameworks.frameworks.map((f) => f.name));

      if (spinner) spinner.stop();

      switch (format) {
        case 'json':
          reportDiagramJson(layers);
          break;
        case 'markdown':
          reportDiagramMarkdown(layers);
          break;
        default:
          reportDiagram(layers);
      }
    } catch (error) {
      if (spinner) spinner.fail('Diagram generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: structure ────────────────────────────────────

program
  .command('structure')
  .description('Show project directory structure')
  .action(async () => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const config = await loadProjectConfig();
    const spinner = format === 'console' ? ora('Scanning...').start() : null;

    try {
      const scan = await scanRepository(rootPath, { ignore: config.ignore });

      if (spinner) spinner.stop();

      switch (format) {
        case 'json':
          reportStructureJson(scan.directoryTree);
          break;
        case 'markdown':
          reportStructureMarkdown(scan.directoryTree);
          break;
        default:
          reportStructure(scan.directoryTree, path.basename(rootPath));
      }
    } catch (error) {
      if (spinner) spinner.fail('Structure scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: dependencies ─────────────────────────────────

program
  .command('dependencies')
  .description('Analyze project dependencies')
  .action(async () => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const spinner = format === 'console' ? ora('Analyzing dependencies...').start() : null;

    try {
      const report = await analyzeDependencies(rootPath);

      if (spinner) spinner.stop();

      if (!report) {
        console.log(chalk.yellow('\n  No package.json found in this directory.\n'));
        return;
      }

      switch (format) {
        case 'json':
          reportDependenciesJson(report);
          break;
        case 'markdown':
          reportDependenciesMarkdown(report);
          break;
        default:
          reportDependencies(report);
      }
    } catch (error) {
      if (spinner) spinner.fail('Dependency analysis failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: hotspots ─────────────────────────────────────

program
  .command('hotspots')
  .description('Rank files by risk (git churn × complexity × open issues)')
  .option('--limit <n>', 'number of hotspots to show')
  .option('--since <when>', 'git history window (e.g. "6 months ago", "2024-01-01")')
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
      const report = await analyzeHotspots(rootPath, scan.files, issues, {
        since,
        limit,
        coverage: coverageReport.available ? coverageMap(coverageReport) : undefined,
      });

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

// ── Command: outdated ─────────────────────────────────────

program
  .command('outdated')
  .description('Detect outdated dependencies (offline — compares declared vs installed)')
  .action(async () => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const spinner = format === 'console' ? ora('Checking dependencies...').start() : null;

    try {
      const report = await detectOutdated(rootPath);
      if (spinner) spinner.stop();

      switch (format) {
        case 'json':
          reportOutdatedJson(report);
          break;
        case 'markdown':
          reportOutdatedMarkdown(report);
          break;
        case 'sarif':
          console.log(JSON.stringify(issuesToSarif([], pkg.version), null, 2));
          break;
        default:
          reportOutdated(report);
      }
    } catch (error) {
      if (spinner) spinner.fail('Outdated check failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: audit ────────────────────────────────────────

program
  .command('audit')
  .description('Run npm audit and surface vulnerabilities (SARIF supported)')
  .option('--timeout <ms>', 'override npm audit timeout (default 60000)')
  .action(async (cmdOpts) => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const spinner = format === 'console' ? ora('Running npm audit...').start() : null;

    try {
      const timeoutMs = cmdOpts.timeout ? Math.max(5_000, parseInt(cmdOpts.timeout, 10)) : undefined;
      const report = await runAudit(rootPath, timeoutMs !== undefined ? { timeoutMs } : {});
      if (spinner) spinner.stop();

      switch (format) {
        case 'json':
          reportAuditJson(report);
          break;
        case 'markdown':
          reportAuditMarkdown(report);
          break;
        case 'sarif':
          console.log(JSON.stringify(issuesToSarif(auditFindingsToIssues(report), pkg.version), null, 2));
          break;
        default:
          reportAudit(report);
      }
    } catch (error) {
      if (spinner) spinner.fail('Audit failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: upgrade ──────────────────────────────────────

program
  .command('upgrade <package>')
  .description('Preview the impact of upgrading a package (offline — reads local CHANGELOG + importers)')
  .action(async (pkgName: string) => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const config = await loadProjectConfig();
    const spinner = format === 'console' ? ora(`Previewing ${pkgName}...`).start() : null;

    try {
      const scan = await scanRepository(rootPath, { ignore: config.ignore });
      const preview = await previewUpgrade(rootPath, pkgName, scan.files);
      if (spinner) spinner.stop();

      switch (format) {
        case 'json':
          reportUpgradeJson(preview);
          break;
        case 'markdown':
          reportUpgradeMarkdown(preview);
          break;
        default:
          reportUpgrade(preview);
      }
    } catch (error) {
      if (spinner) spinner.fail('Upgrade preview failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: coverage ─────────────────────────────────────

program
  .command('coverage')
  .description('Join test coverage with hotspots — surface the scariest untested files')
  .option('--limit <n>', 'limit number of entries shown', '30')
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

// ── Command: mcp ──────────────────────────────────────────

program
  .command('mcp')
  .description('Run projscan as an MCP server (stdio) for AI coding agents')
  .action(async () => {
    setLogLevel('quiet');
    const rootPath = getRootPath();
    try {
      await runMcpServer(rootPath);
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── Command: badge ────────────────────────────────────────

program
  .command('badge')
  .description('Generate a health badge for your README')
  .option('--markdown', 'output as markdown image link')
  .action(async (cmdOpts) => {
    setupLogLevel();
    maybeCompactBanner();
    const rootPath = getRootPath();
    const spinner = ora('Calculating health score...').start();
    const config = await loadProjectConfig();

    try {
      const scan = await scanRepository(rootPath, { ignore: config.ignore });
      let issues = await collectIssues(rootPath, scan.files);
      issues = applyConfigToIssues(issues, config);
      const { score, grade } = calculateScore(issues);

      spinner.stop();

      const gradeColor = grade === 'A' || grade === 'B' ? chalk.green : grade === 'C' ? chalk.yellow : chalk.red;
      console.log(`\n  Health Score: ${gradeColor(chalk.bold(`${grade} (${score}/100)`))}\n`);

      if (cmdOpts.markdown) {
        console.log(`  ${badgeMarkdown(grade)}\n`);
      } else {
        console.log(`  ${chalk.bold('Badge URL:')}`);
        console.log(`  ${badgeUrl(grade)}\n`);
        console.log(`  ${chalk.bold('Markdown:')}`);
        console.log(`  ${badgeMarkdown(grade)}\n`);
      }

      console.log(chalk.dim('  Add this to your README to show your project health score.\n'));
    } catch (error) {
      spinner.fail('Badge generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ── File Analysis (for explain command) ───────────────────

function analyzeFile(filePath: string, content: string): FileExplanation {
  const lines = content.split('\n');
  const imports = extractImports(content);
  const exports = extractExports(content);
  const purpose = inferPurpose(filePath, exports);
  const potentialIssues = detectFileIssues(content, lines.length);

  return {
    filePath: path.relative(process.cwd(), filePath),
    purpose,
    imports,
    exports,
    potentialIssues,
    lineCount: lines.length,
  };
}

// ── Architecture Layer Detection ──────────────────────────

function buildArchitectureLayers(
  files: import('../types.js').FileEntry[],
  frameworkNames: string[],
): ArchitectureLayer[] {
  const layers: ArchitectureLayer[] = [];
  const dirs = new Set(files.map((f) => f.directory.split(path.sep)[0]).filter(Boolean));

  // Frontend layer
  const frontendDirs = ['pages', 'components', 'views', 'layouts', 'public', 'app', 'styles'];
  const frontendMatches = frontendDirs.filter((d) => dirs.has(d) || dirs.has(`src/${d}`));
  const frontendFrameworks = frameworkNames.filter((f) =>
    ['React', 'Next.js', 'Vue.js', 'Nuxt.js', 'Svelte', 'SvelteKit', 'Angular', 'Solid.js'].includes(f),
  );

  if (frontendMatches.length > 0 || frontendFrameworks.length > 0) {
    layers.push({
      name: 'Frontend',
      technologies: frontendFrameworks.length > 0 ? frontendFrameworks : ['Static'],
      directories: frontendMatches,
    });
  }

  // API layer
  const apiDirs = ['api', 'routes', 'controllers', 'endpoints'];
  const apiMatches = apiDirs.filter((d) => dirs.has(d) || dirs.has(`src/${d}`));
  const apiFrameworks = frameworkNames.filter((f) =>
    ['Express', 'Fastify', 'NestJS', 'Hono', 'Koa', 'Apollo Server', 'tRPC'].includes(f),
  );

  if (apiMatches.length > 0 || apiFrameworks.length > 0) {
    layers.push({
      name: 'API Layer',
      technologies: apiFrameworks.length > 0 ? apiFrameworks : ['HTTP'],
      directories: apiMatches,
    });
  }

  // Services layer
  const serviceDirs = ['services', 'lib', 'core', 'domain', 'modules'];
  const serviceMatches = serviceDirs.filter((d) => dirs.has(d) || dirs.has(`src/${d}`));

  if (serviceMatches.length > 0) {
    layers.push({
      name: 'Services',
      technologies: inferServiceTech(files, serviceMatches),
      directories: serviceMatches,
    });
  }

  // Database layer
  const dbDirs = ['db', 'database', 'prisma', 'migrations', 'models', 'entities'];
  const dbMatches = dbDirs.filter((d) => dirs.has(d) || dirs.has(`src/${d}`));
  const dbFrameworks = frameworkNames.filter((f) =>
    ['Prisma', 'Drizzle ORM', 'Mongoose', 'TypeORM', 'Sequelize'].includes(f),
  );

  if (dbMatches.length > 0 || dbFrameworks.length > 0) {
    layers.push({
      name: 'Database',
      technologies: dbFrameworks.length > 0 ? dbFrameworks : ['Database'],
      directories: dbMatches,
    });
  }

  // If no layers detected, show a generic one
  if (layers.length === 0) {
    const topDirs = [...dirs].slice(0, 5);
    layers.push({
      name: 'Application',
      technologies: frameworkNames.length > 0 ? frameworkNames : ['Unknown'],
      directories: topDirs,
    });
  }

  return layers;
}

function inferServiceTech(
  files: import('../types.js').FileEntry[],
  serviceDirs: string[],
): string[] {
  const techs: string[] = [];
  const serviceFiles = files.filter((f) => serviceDirs.some((d) => f.directory.startsWith(d)));

  const hasTsFiles = serviceFiles.some((f) => f.extension === '.ts' || f.extension === '.tsx');
  const hasJsFiles = serviceFiles.some((f) => f.extension === '.js' || f.extension === '.jsx');

  if (hasTsFiles) techs.push('TypeScript');
  else if (hasJsFiles) techs.push('JavaScript');

  if (techs.length === 0) techs.push('Mixed');
  return techs;
}

// ── Helpers ───────────────────────────────────────────────

function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

// ── Command: help ─────────────────────────────────────────

program
  .command('help')
  .description('Show detailed help with all commands and options')
  .action(() => {
    showHelp();
  });

// ── Run ───────────────────────────────────────────────────

program.parse();
