import chalk from 'chalk';

import {
  resolveReporterPlugin,
  renderReporterPlugin,
  type PluginDiagnostic,
  type PluginReporterCommand,
} from '../core/plugins.js';
import type { ReportFormat } from '../types/config.js';

interface RenderCliPluginReporterOptions {
  command: PluginReporterCommand;
  reporterName: unknown;
  payload: unknown;
  format: ReportFormat;
  rootPath: string;
}

export async function renderCliPluginReporterIfRequested(
  options: RenderCliPluginReporterOptions,
): Promise<boolean> {
  if (!isPluginReporterName(options.reporterName)) return false;
  if (options.format !== 'console') {
    console.error(chalk.red(pluginReporterFormatError(options.format)));
    process.exit(1);
  }

  const resolved = await resolveReporterPlugin(
    options.rootPath,
    options.reporterName,
    options.command,
  );
  if (!resolved.ok) {
    printPluginReporterDiagnostic(resolved.diagnostic);
    process.exit(1);
  }
  const rendered = await renderReporterPlugin(resolved.plugin, {
    command: options.command,
    rootPath: options.rootPath,
    manifest: resolved.plugin.manifest,
    payload: options.payload,
  });
  if (!rendered.ok) {
    printPluginReporterDiagnostic(rendered.diagnostic);
    process.exit(1);
  }
  console.log(rendered.output);
  return true;
}

export function isPluginReporterName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function pluginReporterFormatError(format: ReportFormat): string {
  return `--reporter cannot be combined with --format ${format}`;
}

export function pluginReporterDiagnosticLines(diagnostic: PluginDiagnostic): string[] {
  const lines = [`[${diagnostic.code}] ${diagnostic.message}`];
  if (diagnostic.hint) lines.push(`hint: ${diagnostic.hint}`);
  return lines;
}

function printPluginReporterDiagnostic(diagnostic: PluginDiagnostic): void {
  const [first, ...rest] = pluginReporterDiagnosticLines(diagnostic);
  console.error(chalk.red(first));
  for (const line of rest) console.error(chalk.dim(line));
}
