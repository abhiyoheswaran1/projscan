import chalk from 'chalk';
import path from 'node:path';

import { enableOfflineMode } from '../core/privacy.js';
import { loadConfig } from '../utils/config.js';
import type { ProjscanConfig, ReportFormat } from '../types/config.js';

interface LoadCliProjectConfigOptions {
  rootPath: string;
  configOption: unknown;
  quiet: boolean;
  format: ReportFormat;
}

export async function loadCliProjectConfig(
  options: LoadCliProjectConfigOptions,
): Promise<ProjscanConfig> {
  const explicit = explicitConfigPath(options.configOption);
  try {
    const { config, source } = await loadConfig(options.rootPath, explicit);
    applyProjectConfigRuntime(config);
    const sourceNotice = projectConfigSourceNotice(options.rootPath, source);
    if (sourceNotice && !options.quiet && options.format === 'console') {
      console.error(chalk.dim(sourceNotice));
    }
    return config;
  } catch (err) {
    console.error(chalk.red(configErrorMessage(err)));
    process.exit(1);
  }
}

export function explicitConfigPath(configOption: unknown): string | undefined {
  return typeof configOption === 'string' ? configOption : undefined;
}

export function projectConfigSourceNotice(rootPath: string, source?: string | null): string | null {
  if (!source) return null;
  return `  [config: ${path.relative(rootPath, source) || source}]`;
}

export function configErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `  Config error: ${message}`;
}

function applyProjectConfigRuntime(config: ProjscanConfig): void {
  if (config.scan?.offline) enableOfflineMode();
  if (config.scan?.includeIgnored) process.env.PROJSCAN_INCLUDE_IGNORED = '1';
  if (config.scan?.scanEnvValues) process.env.PROJSCAN_SCAN_ENV_VALUES = '1';
}
