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
    `${w('mcp')}        ${dim('MCP server (primary)')}`,
    `${w('doctor')}     ${dim('Health check')}`,
    `${w('hotspots')}   ${dim('Risk-rank files')}`,
    `${w('coverage')}   ${dim('Untested hotspots')}`,
    `${w('upgrade')}    ${dim('Preview upgrade')}`,
    `${w('audit')}      ${dim('Vulnerabilities')}`,
    `${dim('...projscan --help')}`,
    `${head("What's new")}`,
    `${dim('Real AST parsing')}`,
    `${dim('Code graph + cache')}`,
    `${dim('2 new MCP tools')}`,
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
 * Help screen — shown by `projscan help`.
 * Displays the full banner + detailed command reference.
 */
export function showHelp(): void {
  showBanner();

  const dim = chalk.dim;
  const cyan = chalk.cyan;
  const w = chalk.white.bold;
  const g = chalk.gray;

  const commands = [
    { cmd: 'projscan',                       desc: 'Full project analysis (default)' },
    { cmd: 'projscan doctor',                desc: 'Health check — detect issues and score your project' },
    { cmd: 'projscan hotspots',              desc: 'Rank files by risk — churn × complexity × issues × ownership' },
    { cmd: 'projscan file <path>',           desc: 'Drill into a file — purpose, risk, ownership, issues' },
    { cmd: 'projscan fix',                   desc: 'Auto-fix detected issues (interactive)' },
    { cmd: 'projscan fix -y',                desc: 'Auto-fix without prompting' },
    { cmd: 'projscan ci',                    desc: 'CI gate — exit 1 if score below threshold' },
    { cmd: 'projscan ci --min-score 80',     desc: 'Set custom minimum score' },
    { cmd: 'projscan ci --changed-only',     desc: 'Gate only on issues in this PR\'s diff' },
    { cmd: 'projscan ci --format sarif',     desc: 'Emit SARIF 2.1.0 for GitHub Code Scanning' },
    { cmd: 'projscan diff',                  desc: 'Compare current health against saved baseline' },
    { cmd: 'projscan diff --save-baseline',  desc: 'Save current state as baseline' },
    { cmd: 'projscan explain <file>',        desc: 'Explain a file — purpose, imports, exports' },
    { cmd: 'projscan diagram',               desc: 'Show architecture layer diagram' },
    { cmd: 'projscan structure',             desc: 'Show directory structure overview' },
    { cmd: 'projscan dependencies',          desc: 'Analyze project dependencies' },
    { cmd: 'projscan outdated',              desc: 'Declared-vs-installed drift (offline)' },
    { cmd: 'projscan audit',                 desc: 'Run npm audit; SARIF-ready vulnerability report' },
    { cmd: 'projscan upgrade <pkg>',         desc: 'Preview upgrade impact (CHANGELOG + importers, offline)' },
    { cmd: 'projscan coverage',              desc: 'Coverage × hotspots — surface scariest untested files' },
    { cmd: 'projscan badge',                 desc: 'Generate a health badge for your README' },
    { cmd: 'projscan mcp',                   desc: 'Run as MCP server for AI agents (Claude Code, Cursor, …)' },
  ];

  const maxCmd = Math.max(...commands.map(c => c.cmd.length));

  console.log(`  ${cyan('Usage')}`);
  console.log(dim('  ─'.repeat(20)));
  console.log('');

  for (const { cmd, desc } of commands) {
    console.log(`  ${w(cmd.padEnd(maxCmd + 2))} ${g(desc)}`);
  }

  console.log('');
  console.log(`  ${cyan('Global Options')}`);
  console.log(dim('  ─'.repeat(20)));
  console.log('');
  console.log(`  ${w('--format <type>')}    ${g('Output format: console, json, markdown, sarif')}`);
  console.log(`  ${w('--config <path>')}    ${g('Path to a .projscanrc config file')}`);
  console.log(`  ${w('--changed-only')}     ${g('Scope to files changed vs base ref (ci/analyze/doctor)')}`);
  console.log(`  ${w('--base-ref <ref>')}   ${g('Git base ref for --changed-only (default: origin/main)')}`);
  console.log(`  ${w('--verbose')}          ${g('Enable verbose/debug output')}`);
  console.log(`  ${w('--quiet')}            ${g('Suppress non-essential output')}`);
  console.log(`  ${w('--version')}          ${g('Show version number')}`);
  console.log('');
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
