import chalk from 'chalk';
import type { OutdatedReport } from '../types.js';

const DRIFT_COLORS = {
  major: chalk.red,
  minor: chalk.yellow,
  patch: chalk.blue,
  same: chalk.dim,
  unknown: chalk.dim,
};

export function reportOutdated(report: OutdatedReport): void {
  if (!report.available) {
    console.log(chalk.yellow(`\n  ${report.reason}\n`));
    return;
  }

  const drifting = report.packages.filter((pkg) => pkg.drift !== 'same' && pkg.drift !== 'unknown');
  const missing = report.packages.filter((pkg) => !pkg.installed);

  console.log(header('Outdated Packages'));
  console.log(
    `  ${chalk.bold(report.totalPackages)} declared · ${chalk.bold(drifting.length)} drifted · ${chalk.bold(missing.length)} not installed\n`,
  );

  if (drifting.length === 0 && missing.length === 0) {
    console.log(`  ${chalk.green('✓')} All declared packages match installed versions.\n`);
    return;
  }

  printDriftGroups(drifting);
  printMissingPackages(missing);
}

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

function printDriftGroups(drifting: OutdatedReport['packages']): void {
  for (const level of ['major', 'minor', 'patch'] as const) {
    const packages = drifting.filter((pkg) => pkg.drift === level);
    if (packages.length === 0) continue;
    const colour = DRIFT_COLORS[level];
    console.log(`  ${colour.bold(level.toUpperCase())} (${packages.length})`);
    for (const pkg of packages) {
      const scope = pkg.scope === 'devDependency' ? chalk.dim(' [dev]') : '';
      console.log(
        `    ${chalk.bold(pkg.name.padEnd(30))} ${chalk.dim(pkg.declared)} → ${colour(pkg.installed ?? '?')}${scope}`,
      );
    }
    console.log('');
  }
}

function printMissingPackages(missing: OutdatedReport['packages']): void {
  if (missing.length === 0) return;

  console.log(`  ${chalk.dim('Not installed')} (${missing.length})`);
  for (const pkg of missing.slice(0, 10)) {
    console.log(`    ${chalk.dim(pkg.name)} ${chalk.dim(pkg.declared)}`);
  }
  if (missing.length > 10) console.log(`    ${chalk.dim(`… and ${missing.length - 10} more`)}`);
  console.log('');
}
