#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs/promises';
import readline from 'node:readline';

import { scanRepository } from '../core/repositoryScanner.js';
import { detectLanguages } from '../core/languageDetector.js';
import { detectFrameworks } from '../core/frameworkDetector.js';
import { analyzeDependencies } from '../core/dependencyAnalyzer.js';
import { collectIssues } from '../core/issueEngine.js';
import { getAllAvailableFixes } from '../fixes/fixRegistry.js';
import { setLogLevel } from '../utils/logger.js';
import { calculateScore, badgeUrl, badgeMarkdown } from '../utils/scoreCalculator.js';
import { showBanner } from '../utils/banner.js';
import { saveBaseline, loadBaseline, computeDiff } from '../utils/baseline.js';

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
} from '../reporters/markdownReporter.js';

import type {
  AnalysisReport,
  FileExplanation,
  ImportInfo,
  ExportInfo,
  ArchitectureLayer,
  ReportFormat,
  FixResult,
} from '../types.js';

// ── CLI Setup ─────────────────────────────────────────────

const program = new Command();

program
  .name('projscan')
  .description('Instant codebase insights — doctor, x-ray, and architecture map for any repository')
  .version('0.1.0')
  .option('--format <type>', 'output format: console, json, markdown', 'console')
  .option('--verbose', 'enable verbose output')
  .option('--quiet', 'suppress non-essential output');

function getFormat(): ReportFormat {
  const opts = program.opts();
  const f = opts.format as string;
  if (f === 'json' || f === 'markdown') return f;
  return 'console';
}

function getRootPath(): string {
  return process.cwd();
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
    } catch {
      // Never let banner errors block the actual command
    }
  }
}

// ── Command: analyze (default) ────────────────────────────

program
  .command('analyze', { isDefault: true })
  .description('Analyze repository and show project report')
  .action(async () => {
    setupLogLevel();
    maybeBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const spinner = format === 'console' ? ora('Scanning repository...').start() : null;

    try {
      const scan = await scanRepository(rootPath);
      if (spinner) spinner.text = 'Detecting languages...';
      const languages = detectLanguages(scan.files);

      if (spinner) spinner.text = 'Detecting frameworks...';
      const frameworks = await detectFrameworks(rootPath, scan.files);

      if (spinner) spinner.text = 'Analyzing dependencies...';
      const dependencies = await analyzeDependencies(rootPath);

      if (spinner) spinner.text = 'Checking for issues...';
      const issues = await collectIssues(rootPath, scan.files);

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
  .action(async () => {
    setupLogLevel();
    maybeBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const spinner = format === 'console' ? ora('Running health checks...').start() : null;

    try {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);

      if (spinner) spinner.stop();

      switch (format) {
        case 'json':
          reportHealthJson(issues);
          break;
        case 'markdown':
          reportHealthMarkdown(issues);
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
  .option('--min-score <score>', 'minimum passing score (0-100)', '70')
  .action(async (cmdOpts) => {
    setupLogLevel();
    const rootPath = getRootPath();
    const format = getFormat();

    try {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
      const threshold = Math.max(0, Math.min(100, parseInt(cmdOpts.minScore, 10) || 70));
      const { score } = calculateScore(issues);

      switch (format) {
        case 'json':
          reportCiJson(issues, threshold);
          break;
        case 'markdown':
          reportCiMarkdown(issues, threshold);
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
    const rootPath = getRootPath();
    const format = getFormat();

    try {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);

      if (cmdOpts.saveBaseline) {
        const filePath = await saveBaseline(rootPath, issues);
        const { score, grade } = calculateScore(issues);
        console.log(chalk.green(`\n  Baseline saved to ${filePath}`));
        console.log(`  Score: ${chalk.bold(`${grade} (${score}/100)`)}`);
        console.log(`  Issues: ${issues.length}\n`);
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

      const diff = computeDiff(baseline, issues);

      switch (format) {
        case 'json':
          reportDiffJson(diff);
          break;
        case 'markdown':
          reportDiffMarkdown(diff);
          break;
        default:
          if (format === 'console') maybeBanner();
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
    maybeBanner();
    const rootPath = getRootPath();
    const spinner = ora('Detecting issues...').start();

    try {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
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

// ── Command: explain ──────────────────────────────────────

program
  .command('explain <file>')
  .description('Explain a file — its purpose, dependencies, and exports')
  .action(async (filePath: string) => {
    setupLogLevel();
    maybeBanner();
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
    maybeBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const spinner = format === 'console' ? ora('Analyzing architecture...').start() : null;

    try {
      const scan = await scanRepository(rootPath);
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
    maybeBanner();
    const rootPath = getRootPath();
    const format = getFormat();
    const spinner = format === 'console' ? ora('Scanning...').start() : null;

    try {
      const scan = await scanRepository(rootPath);

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
    maybeBanner();
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

// ── Command: badge ────────────────────────────────────────

program
  .command('badge')
  .description('Generate a health badge for your README')
  .option('--markdown', 'output as markdown image link')
  .action(async (cmdOpts) => {
    setupLogLevel();
    maybeBanner();
    const rootPath = getRootPath();
    const spinner = ora('Calculating health score...').start();

    try {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
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
  const purpose = inferPurpose(filePath, imports, exports);
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

function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const seen = new Set<string>();

  // ES import
  const esImportRegex = /import\s+(?:(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+\w+)\s+from\s+)?['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = esImportRegex.exec(content)) !== null) {
    const source = match[1];
    if (!seen.has(source)) {
      seen.add(source);
      imports.push({
        source,
        specifiers: [],
        isRelative: source.startsWith('.') || source.startsWith('/'),
      });
    }
  }

  // CommonJS require
  const requireRegex = /(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = requireRegex.exec(content)) !== null) {
    const source = match[1];
    if (!seen.has(source)) {
      seen.add(source);
      imports.push({
        source,
        specifiers: [],
        isRelative: source.startsWith('.') || source.startsWith('/'),
      });
    }
  }

  return imports;
}

function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];

  // export function
  const funcRegex = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'function' });
  }

  // export class
  const classRegex = /^export\s+class\s+(\w+)/gm;
  while ((match = classRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'class' });
  }

  // export const/let/var
  const varRegex = /^export\s+(?:const|let|var)\s+(\w+)/gm;
  while ((match = varRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'variable' });
  }

  // export interface
  const interfaceRegex = /^export\s+interface\s+(\w+)/gm;
  while ((match = interfaceRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'interface' });
  }

  // export type
  const typeRegex = /^export\s+type\s+(\w+)/gm;
  while ((match = typeRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'type' });
  }

  // export default
  if (/^export\s+default/m.test(content)) {
    exports.push({ name: 'default', type: 'default' });
  }

  return exports;
}

function inferPurpose(filePath: string, imports: ImportInfo[], exports: ExportInfo[]): string {
  const name = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const dir = path.dirname(filePath).toLowerCase();

  if (name.includes('test') || name.includes('spec')) return 'Test file';
  if (name.includes('config') || name.includes('rc')) return 'Configuration file';
  if (name === 'index') return 'Module entry point / barrel file';
  if (name === 'main' || name === 'app') return 'Application entry point';
  if (name.includes('route') || name.includes('router')) return 'Route definitions';
  if (name.includes('middleware')) return 'Middleware handler';
  if (name.includes('controller')) return 'Request controller';
  if (name.includes('service')) return 'Service layer logic';
  if (name.includes('model') || name.includes('schema')) return 'Data model / schema definition';
  if (name.includes('util') || name.includes('helper')) return 'Utility functions';
  if (name.includes('hook')) return 'Custom hook';
  if (name.includes('context') || name.includes('provider')) return 'Context / state provider';
  if (name.includes('type') || name.includes('interface')) return 'Type definitions';
  if (name.includes('constant') || name.includes('config')) return 'Constants / configuration';
  if (name.includes('migration')) return 'Database migration';
  if (name.includes('seed')) return 'Database seed data';
  if (name.includes('auth')) return 'Authentication logic';
  if (name.includes('api')) return 'API endpoint handler';

  if (dir.includes('component') || dir.includes('pages')) return 'UI component';
  if (dir.includes('service')) return 'Service module';
  if (dir.includes('model')) return 'Data model';
  if (dir.includes('util') || dir.includes('lib')) return 'Library / utility module';

  const exportTypes = exports.map((e) => e.type);
  if (exportTypes.includes('class')) return 'Class-based module';
  if (exportTypes.filter((t) => t === 'function').length > 2) return 'Function library';

  return 'Source module';
}

function detectFileIssues(content: string, lineCount: number): string[] {
  const issues: string[] = [];

  if (lineCount > 500) issues.push(`Large file (${lineCount} lines) — consider splitting`);
  if (lineCount > 1000) issues.push('Very large file — strongly consider refactoring');

  if (/console\.(log|warn|error|debug)\s*\(/.test(content)) {
    issues.push('Contains console.log statements — consider using a proper logger');
  }

  if (/TODO|FIXME|HACK|XXX/i.test(content)) {
    issues.push('Contains TODO/FIXME comments');
  }

  if (/any\b/.test(content) && /\.tsx?$/.test(content)) {
    issues.push('Uses "any" type — consider using proper types');
  }

  return issues;
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

// ── Run ───────────────────────────────────────────────────

program.parse();
