import chalk from 'chalk';

import { OUTPUT_FORMATS, formatList, getCommandFormatSupport } from '../utils/formatSupport.js';
import type { ReportFormat } from '../types/config.js';

export type CliFormatFailure = (messages: string[]) => never;

export function resolveCliFormat(
  formatOption: unknown,
  fail: CliFormatFailure = exitWithFormatMessages,
): ReportFormat {
  const format = String(formatOption);
  if ((OUTPUT_FORMATS as readonly string[]).includes(format)) return format as ReportFormat;
  fail([
    chalk.red(`Unsupported --format ${format}.`),
    chalk.dim(`Supported formats: ${formatList()}`),
  ]);
}

export function assertCliFormatSupported(
  commandName: string,
  formatOption: unknown,
  fail: CliFormatFailure = exitWithFormatMessages,
): ReportFormat {
  const format = resolveCliFormat(formatOption, fail);
  const supported = getCommandFormatSupport(commandName);
  if (!supported) {
    fail([chalk.red(`Internal error: no --format support metadata for projscan ${commandName}.`)]);
  }
  if (supported.includes(format)) return format;
  fail([
    chalk.red(`projscan ${commandName} does not support --format ${format}.`),
    chalk.dim(`Supported formats: ${formatList(supported)}`),
  ]);
}

function exitWithFormatMessages(messages: string[]): never {
  for (const message of messages) console.error(message);
  process.exit(1);
}
