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
 * Full two-panel welcome screen — shown only on the default `projscan` command.
 * Left panel: ASCII logo + version. Right panel: commands + what's new.
 */
export function showBanner(): void {
  const version = getVersion();

  const c = chalk.cyan.bold;
  const dim = chalk.dim;
  const head = chalk.cyan;
  const w = chalk.white;

  // Left panel lines (logo + info)
  const L = [
    '',
    `  ${c('██████╗ ██████╗  ██████╗      ██╗')} `,
    `  ${c('██╔══██╗██╔══██╗██╔═══██╗     ██║')} `,
    `  ${c('██████╔╝██████╔╝██║   ██║     ██║')} `,
    `  ${c('██╔═══╝ ██╔══██╗██║   ██║██   ██║')} `,
    `  ${c('██║     ██║  ██║╚██████╔╝╚█████╔╝')} `,
    `  ${c('╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚════╝')}  `,
    '',
    `  ${dim(`v${version}`)} ${dim('·')} ${dim('Instant codebase insights')}`,
    `  ${dim('github.com/abhiyoheswaran1/projscan')}`,
    '',
  ];

  // Right panel lines (commands + what's new)
  const R = [
    `${head('Commands')}`,
    `${w('doctor')}     ${dim('Health check')}`,
    `${w('fix')}        ${dim('Auto-fix issues')}`,
    `${w('ci')}         ${dim('CI health gate')}`,
    `${w('diff')}       ${dim('Compare baseline')}`,
    `${w('explain')}    ${dim('Explain a file')}`,
    `${w('diagram')}    ${dim('Architecture map')}`,
    `${dim('...projscan --help')}`,
    `${head("What's new")}`,
    `${dim('Security checker')}`,
    `${dim('CI health gate & diff')}`,
  ];

  const leftW = 42;
  const rightW = 32;
  const totalW = leftW + 1 + rightW; // +1 for the middle divider

  const title = ` ProjScan v${version} `;
  const dashCount = totalW - title.length;
  const dashLeft = Math.floor(dashCount / 2);
  const dashRight = dashCount - dashLeft;
  const topLine = dim('  ╭') + dim('╌'.repeat(dashLeft)) + dim(title) + dim('╌'.repeat(dashRight)) + dim('╮');
  const botLine = dim(`  ╰${'─'.repeat(totalW)}╯`);

  const rows = Math.max(L.length, R.length);

  console.log('');
  console.log(topLine);

  for (let i = 0; i < rows; i++) {
    const left = i < L.length ? L[i] : '';
    const right = i < R.length ? R[i] : '';
    const sep = (i > 0 && i < rows - 1) ? dim('│') : ' ';
    console.log(dim('  │') + padVisual(left, leftW) + sep + padVisual(right, rightW) + dim('│'));
  }

  console.log(botLine);
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
