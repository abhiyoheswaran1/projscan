import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { explainFile as explainProjectFile } from '../core/fileInspector.js';
import { setLogLevel } from '../utils/logger.js';
import { showBanner, showCompactBanner } from '../utils/banner.js';
import { loadConfig } from '../utils/config.js';
import { recordCommandTelemetry } from '../core/telemetry.js';
import { getChangedFiles } from '../utils/changedFiles.js';
import { OUTPUT_FORMATS, formatList, getCommandFormatSupport } from '../utils/formatSupport.js';
import {
  resolveReporterPlugin,
  renderReporterPlugin,
  type PluginDiagnostic,
  type PluginReporterCommand,
} from '../core/plugins.js';
import type {
  ArchitectureLayer,
  FileExplanation,
  Issue,
  ProjscanConfig,
  ReportFormat,
  FileEntry,
  DirectoryNode,
} from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));

export const program = new Command();

program
  .name('projscan')
  .description('Instant codebase insights - doctor, x-ray, and architecture map for any repository')
  .version(pkg.version)
  .option('--format <type>', `output format: ${formatList()} (command-dependent)`, 'console')
  .option('--config <path>', 'path to .projscanrc config file')
  .option('--verbose', 'enable verbose output')
  .option('--quiet', 'suppress non-essential output');

let activeTelemetryRun: { commandName: string; startedAt: number } | null = null;

program.hook('preAction', (_thisCommand, actionCommand) => {
  activeTelemetryRun = { commandName: commandPath(actionCommand), startedAt: Date.now() };
});

program.hook('postAction', async (_thisCommand, actionCommand) => {
  const run = activeTelemetryRun ?? { commandName: commandPath(actionCommand), startedAt: Date.now() };
  activeTelemetryRun = null;
  await recordCommandTelemetry({
    commandName: run.commandName,
    status: 'success',
    durationMs: Date.now() - run.startedAt,
    rootPath: getRootPath(),
    version: pkg.version,
  }).catch(() => undefined);
});

function commandPath(actionCommand: Command): string {
  const parts: string[] = [];
  let current: Command | null = actionCommand;
  while (current && current.name() !== 'projscan') {
    const name = current.name();
    if (name) parts.unshift(name);
    current = current.parent ?? null;
  }
  return parts.join(' ') || actionCommand.name() || 'unknown';
}

export function getFormat(): ReportFormat {
  const opts = program.opts();
  const f = opts.format as string;
  if ((OUTPUT_FORMATS as readonly string[]).includes(f)) return f as ReportFormat;
  console.error(chalk.red(`Unsupported --format ${f}.`));
  console.error(chalk.dim(`Supported formats: ${formatList()}`));
  process.exit(1);
}

export function assertFormatSupported(commandName: string): ReportFormat {
  const format = getFormat();
  const supported = getCommandFormatSupport(commandName);
  if (!supported) {
    console.error(chalk.red(`Internal error: no --format support metadata for projscan ${commandName}.`));
    process.exit(1);
  }
  if (supported.includes(format)) return format;
  console.error(chalk.red(`projscan ${commandName} does not support --format ${format}.`));
  console.error(chalk.dim(`Supported formats: ${formatList(supported)}`));
  process.exit(1);
}

export function getRootPath(): string {
  return process.cwd();
}

export async function loadProjectConfig(): Promise<ProjscanConfig> {
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

export async function filterIssuesByChangedFiles(
  issues: Issue[],
  rootPath: string,
  baseRef?: string,
): Promise<Issue[]> {
  const result = await getChangedFiles(rootPath, baseRef);
  if (!result.available) {
    if (getFormat() === 'console' && !program.opts().quiet) {
      console.error(chalk.yellow(`  [--changed-only: ${result.reason ?? 'unavailable'} - reporting all issues]`));
    }
    return issues;
  }
  if (getFormat() === 'console' && !program.opts().quiet) {
    console.error(chalk.dim(`  [--changed-only: base=${result.baseRef}, ${result.files.length} file(s)]`));
  }
  const set = new Set(result.files);
  const filtered = issues.filter((issue) => {
    if (!issue.locations || issue.locations.length === 0) return false;
    return issue.locations.some((loc) => set.has(loc.file));
  });

  const dropped = issues.length - filtered.length;
  if (dropped > 0 && !program.opts().quiet) {
    const unlocated = issues.filter((i) => !i.locations || i.locations.length === 0).length;
    const message =
      unlocated > 0
        ? `  [--changed-only: ${dropped} issue(s) filtered out; ${unlocated} had no file location]`
        : `  [--changed-only: ${dropped} issue(s) outside the changed-file set]`;
    if (getFormat() === 'console') {
      console.error(chalk.dim(message));
    } else {
      console.error(message.trim());
    }
  }

  return filtered;
}

export function setupLogLevel(): void {
  const opts = program.opts();
  if (opts.verbose) setLogLevel('debug');
  else if (opts.quiet) setLogLevel('quiet');
}

export function maybeBanner(): void {
  const opts = program.opts();
  if (!opts.quiet && getFormat() === 'console') {
    try {
      showBanner();
    } catch (err) {
      console.error(chalk.dim(`  [banner error: ${err instanceof Error ? err.message : String(err)}]`));
    }
  }
}

export function maybeCompactBanner(): void {
  const opts = program.opts();
  if (!opts.quiet && getFormat() === 'console') {
    try {
      showCompactBanner();
    } catch (err) {
      console.error(chalk.dim(`  [banner error: ${err instanceof Error ? err.message : String(err)}]`));
    }
  }
}

export async function renderPluginReporterIfRequested(
  command: PluginReporterCommand,
  reporterName: unknown,
  payload: unknown,
): Promise<boolean> {
  if (typeof reporterName !== 'string' || reporterName.length === 0) return false;
  const format = getFormat();
  if (format !== 'console') {
    console.error(chalk.red(`--reporter cannot be combined with --format ${format}`));
    process.exit(1);
  }

  const rootPath = getRootPath();
  const resolved = await resolveReporterPlugin(rootPath, reporterName, command);
  if (!resolved.ok) {
    printPluginReporterDiagnostic(resolved.diagnostic);
    process.exit(1);
  }
  const rendered = await renderReporterPlugin(resolved.plugin, {
    command,
    rootPath,
    manifest: resolved.plugin.manifest,
    payload,
  });
  if (!rendered.ok) {
    printPluginReporterDiagnostic(rendered.diagnostic);
    process.exit(1);
  }
  console.log(rendered.output);
  return true;
}

function printPluginReporterDiagnostic(diagnostic: PluginDiagnostic): void {
  console.error(chalk.red(`[${diagnostic.code}] ${diagnostic.message}`));
  if (diagnostic.hint) console.error(chalk.dim(`hint: ${diagnostic.hint}`));
}

/** Walk a DirectoryNode to find the node whose `path` matches targetPath. */
export function sliceCliTree(node: DirectoryNode, targetPath: string): DirectoryNode | null {
  if (node.path === targetPath) return node;
  for (const child of node.children) {
    const hit = sliceCliTree(child, targetPath);
    if (hit) return hit;
  }
  return null;
}

export async function analyzeFile(filePath: string): Promise<FileExplanation> {
  const rootPath = process.cwd();
  return await explainProjectFile(rootPath, path.relative(rootPath, filePath));
}

export function buildArchitectureLayers(files: FileEntry[], frameworkNames: string[]): ArchitectureLayer[] {
  const layers: ArchitectureLayer[] = [];
  const dirs = new Set(files.map((f) => f.directory.split(path.sep)[0]).filter(Boolean));

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

  const serviceDirs = ['services', 'lib', 'core', 'domain', 'modules'];
  const serviceMatches = serviceDirs.filter((d) => dirs.has(d) || dirs.has(`src/${d}`));
  if (serviceMatches.length > 0) {
    layers.push({
      name: 'Services',
      technologies: inferServiceTech(files, serviceMatches),
      directories: serviceMatches,
    });
  }

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

function inferServiceTech(files: FileEntry[], serviceDirs: string[]): string[] {
  const techs: string[] = [];
  const serviceFiles = files.filter((f) => serviceDirs.some((d) => f.directory.startsWith(d)));
  const hasTsFiles = serviceFiles.some((f) => f.extension === '.ts' || f.extension === '.tsx');
  const hasJsFiles = serviceFiles.some((f) => f.extension === '.js' || f.extension === '.jsx');
  if (hasTsFiles) techs.push('TypeScript');
  else if (hasJsFiles) techs.push('JavaScript');
  if (techs.length === 0) techs.push('Mixed');
  return techs;
}

export function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}
