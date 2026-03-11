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
 * Full banner — shown only on the default `projscan` command.
 * Clean, modern design with rounded corners and diamond marker.
 */
export function showBanner(): void {
  const version = getVersion();
  const w = 44;

  const dim = chalk.dim;
  const cyan = chalk.cyan;
  const white = chalk.white.bold;

  const top = dim(`  ╭${'─'.repeat(w)}╮`);
  const bot = dim(`  ╰${'─'.repeat(w)}╯`);
  const row = (s: string) => dim('  │') + padVisual(s, w) + dim('│');
  const blank = row('');

  console.log('');
  console.log(top);
  console.log(blank);
  console.log(row(`    ${cyan('◆')}  ${white('ProjScan')}`));
  console.log(blank);
  console.log(row(`    ${dim(`v${version}`)}`));
  console.log(row(`    ${dim('Instant codebase insights')}`));
  console.log(blank);
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
    `  ${chalk.cyan('◆')} ${chalk.white.bold('ProjScan')} ${chalk.dim(`v${version}`)}`,
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
