import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { explainFile as explainProjectFile } from '../core/fileInspector.js';
import { setLogLevel } from '../utils/logger.js';
import { showBanner, showCompactBanner } from '../utils/banner.js';
import { recordCommandTelemetry } from '../core/telemetry.js';
import { enableOfflineMode } from '../core/privacy.js';
import { getChangedFiles } from '../utils/changedFiles.js';
import { OUTPUT_FORMATS, formatList, getCommandFormatSupport } from '../utils/formatSupport.js';
import {
  resolveReporterPlugin,
  renderReporterPlugin,
  type PluginDiagnostic,
  type PluginReporterCommand,
} from '../core/plugins.js';
import {
  changedFilesAvailableMessage,
  changedFilesUnavailableMessage,
  changedIssueFilterMessage,
  filterIssuesToChangedFiles,
} from './changedIssueFilter.js';
import { loadCliProjectConfig } from './projectConfig.js';
import type { ProjscanConfig, ReportFormat } from '../types/config.js';
import type { FileExplanation, Issue, DirectoryNode } from '../types.js';

export { buildArchitectureLayers } from './architectureLayers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));

export const program = new Command();

program
  .name('projscan')
  .description('Instant codebase insights - doctor, x-ray, and architecture map for any repository')
  .version(pkg.version)
  .option('--format <type>', `output format: ${formatList()} (command-dependent)`, 'console')
  .option('--config <path>', 'path to .projscanrc config file')
  .option('--include-ignored', 'explicitly include files ignored by .gitignore')
  .option('--scan-env-values', 'explicitly read .env* file contents during secret checks')
  .option('--offline', 'block all projscan network-capable features for this run')
  .option('--verbose', 'enable verbose output')
  .option('--quiet', 'suppress non-essential output');

let activeTelemetryRun: { commandName: string; startedAt: number } | null = null;

program.hook('preAction', (_thisCommand, actionCommand) => {
  const opts = program.opts();
  if (opts.offline) enableOfflineMode();
  if (opts.includeIgnored) process.env.PROJSCAN_INCLUDE_IGNORED = '1';
  if (opts.scanEnvValues) process.env.PROJSCAN_SCAN_ENV_VALUES = '1';
  activeTelemetryRun = { commandName: commandPath(actionCommand), startedAt: Date.now() };
});

program.hook('postAction', async (_thisCommand, actionCommand) => {
  const run = activeTelemetryRun ?? {
    commandName: commandPath(actionCommand),
    startedAt: Date.now(),
  };
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
    console.error(
      chalk.red(`Internal error: no --format support metadata for projscan ${commandName}.`),
    );
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
  return await loadCliProjectConfig({
    rootPath: getRootPath(),
    configOption: opts.config,
    quiet: Boolean(opts.quiet),
    format: getFormat(),
  });
}

export async function filterIssuesByChangedFiles(
  issues: Issue[],
  rootPath: string,
  baseRef?: string,
): Promise<Issue[]> {
  const result = await getChangedFiles(rootPath, baseRef);
  const format = getFormat();
  const quiet = Boolean(program.opts().quiet);
  if (!result.available) {
    writeChangedOnlyNotice(changedFilesUnavailableMessage(result.reason), format, quiet, 'warning');
    return issues;
  }
  writeChangedOnlyNotice(
    changedFilesAvailableMessage(result.baseRef, result.files.length),
    format,
    quiet,
    'dim',
  );
  const filtered = filterIssuesToChangedFiles(issues, result.files);
  const filterMessage = changedIssueFilterMessage(filtered);
  if (filterMessage) writeChangedOnlyNotice(filterMessage, format, quiet, 'dim');
  return filtered.issues;
}

function writeChangedOnlyNotice(
  message: string,
  format: ReportFormat,
  quiet: boolean,
  style: 'dim' | 'warning',
): void {
  if (quiet) return;
  if (format !== 'console') {
    console.error(message.trim());
    return;
  }
  console.error(style === 'warning' ? chalk.yellow(message) : chalk.dim(message));
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
      console.error(
        chalk.dim(`  [banner error: ${err instanceof Error ? err.message : String(err)}]`),
      );
    }
  }
}

export function maybeCompactBanner(): void {
  const opts = program.opts();
  if (!opts.quiet && getFormat() === 'console') {
    try {
      showCompactBanner();
    } catch (err) {
      console.error(
        chalk.dim(`  [banner error: ${err instanceof Error ? err.message : String(err)}]`),
      );
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

export function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}
