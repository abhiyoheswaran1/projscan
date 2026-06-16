import chalk from 'chalk';
import type { AuditReport } from '../types.js';

const SEVERITY_COLORS = {
  critical: chalk.red.bold,
  high: chalk.red,
  moderate: chalk.yellow,
  low: chalk.blue,
  info: chalk.dim,
};

export function reportAudit(report: AuditReport): void {
  if (!report.available) {
    console.log(chalk.yellow(`\n  ${report.reason}\n`));
    return;
  }

  console.log(header('Vulnerability Audit'));
  const { summary, findings } = report;
  const total = summary.critical + summary.high + summary.moderate + summary.low + summary.info;

  if (total === 0) {
    console.log(`  ${chalk.green('✓')} ${chalk.bold('No known vulnerabilities.')}\n`);
    return;
  }

  console.log(
    `  ${SEVERITY_COLORS.critical(`${summary.critical} critical`)} · ` +
      `${SEVERITY_COLORS.high(`${summary.high} high`)} · ` +
      `${SEVERITY_COLORS.moderate(`${summary.moderate} moderate`)} · ` +
      `${SEVERITY_COLORS.low(`${summary.low} low`)} · ` +
      `${SEVERITY_COLORS.info(`${summary.info} info`)}\n`,
  );

  for (const f of findings.slice(0, 30)) {
    const colour = SEVERITY_COLORS[f.severity];
    const fix = f.fixAvailable ? chalk.green(' (fix available)') : '';
    console.log(`  ${colour(`[${f.severity.toUpperCase()}]`)} ${chalk.bold(f.name)}${fix}`);
    console.log(`    ${f.title}`);
    if (f.range) console.log(`    ${chalk.dim(`range: ${f.range}`)}`);
    if (f.url) console.log(`    ${chalk.dim(f.url)}`);
    console.log('');
  }

  if (findings.length > 30) {
    console.log(
      chalk.dim(`  … and ${findings.length - 30} more. Use --format json for full list.\n`),
    );
  }

  console.log(chalk.dim('  Tip: run `npm audit fix` to auto-apply safe upgrades.\n'));
}

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}
