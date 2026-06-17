import chalk from 'chalk';
import type { ReportFormat } from '../types/config.js';

interface CliBannerDisplayOptions {
  quiet: boolean;
  format: ReportFormat;
}

export function shouldRenderCliBanner(options: CliBannerDisplayOptions): boolean {
  return !options.quiet && options.format === 'console';
}

export function renderCliBanner(
  options: CliBannerDisplayOptions,
  render: () => void,
  writeError: (message: string) => void = console.error,
): void {
  if (!shouldRenderCliBanner(options)) return;
  try {
    render();
  } catch (err) {
    writeError(chalk.dim(bannerErrorMessage(err)));
  }
}

export function bannerErrorMessage(err: unknown): string {
  return `  [banner error: ${err instanceof Error ? err.message : String(err)}]`;
}
