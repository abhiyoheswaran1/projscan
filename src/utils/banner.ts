import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function getVersion(): string {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Full ASCII art banner — shown only on the default `projscan` command.
 */
export function showBanner(): void {
  const version = getVersion();

  const dim = chalk.dim;
  const cyan = chalk.cyan.bold;
  const green = chalk.green;

  const logo = [
    `${cyan('  ██████╗ ██████╗  ██████╗      ██╗')}`,
    `${cyan('  ██╔══██╗██╔══██╗██╔═══██╗     ██║')}`,
    `${cyan('  ██████╔╝██████╔╝██║   ██║     ██║')}`,
    `${cyan('  ██╔═══╝ ██╔══██╗██║   ██║██   ██║')}`,
    `${cyan('  ██║     ██║  ██║╚██████╔╝╚█████╔╝')}`,
    `${cyan('  ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚════╝')}`,
  ];

  const tagline = `${green(`v${version}`)}  ${dim('·')}  Instant Codebase Insights`;
  const link = dim('github.com/abhiyoheswaran1/projscan');

  const contentLines = [
    '',
    ...logo,
    `         ${dim('┈┈┈')} ${chalk.white.bold('PROJSCAN')} ${dim('┈┈┈')}`,
    '',
    `  ${tagline}`,
    `  ${link}`,
    '',
  ];

  const maxLen = 47;
  const top = dim(` ┌${'─'.repeat(maxLen)}┐`);
  const bot = dim(` └${'─'.repeat(maxLen)}┘`);

  console.log('');
  console.log(top);
  for (const line of contentLines) {
    console.log(dim(' │') + padVisual(line, maxLen) + dim('│'));
  }
  console.log(bot);
  console.log('');
}

/**
 * Compact one-liner — shown on subcommands (doctor, fix, etc.).
 */
export function showCompactBanner(): void {
  const version = getVersion();
  console.log('');
  console.log(
    `  ${chalk.cyan.bold('projscan')} ${chalk.dim(`v${version}`)}`,
  );
}

/**
 * Pads a string with chalk formatting to a fixed visual width.
 * Strips ANSI codes when measuring length so columns align.
 */
function padVisual(str: string, width: number): string {
  // eslint-disable-next-line no-control-regex
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = Math.max(0, width - stripped.length);
  return str + ' '.repeat(padding);
}
