import chalk from 'chalk';
import type { ImpactReport } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportImpact(report: ImpactReport): void {
  console.log(header('Impact'));
  if (!report.available) {
    console.log(`\n  ${chalk.yellow('⚠')} ${report.reason ?? 'Impact unavailable.'}\n`);
    return;
  }
  printImpactTarget(report);
  printSymbolImpactDetails(report);
  printReachableSummary(report);
  printReachableFiles(report);
}

function printImpactTarget(report: ImpactReport): void {
  console.log(`\n  ${chalk.bold(report.target.kind)}: ${chalk.cyan(report.target.value)}\n`);
}

function printSymbolImpactDetails(report: ImpactReport): void {
  if (report.target.kind !== 'symbol') return;
  console.log(
    `  ${chalk.dim(`definitions: ${report.definitionFiles.length} · direct callers: ${report.directCallers.length}`)}`,
  );
  printDefinitionFiles(report);
  console.log('');
}

function printDefinitionFiles(report: ImpactReport): void {
  if (report.definitionFiles.length === 0) return;
  console.log(chalk.bold('\n  Defined in:'));
  for (const f of report.definitionFiles) console.log(`    ${chalk.cyan(f)}`);
}

function printReachableSummary(report: ImpactReport): void {
  const truncatedNote = report.truncated
    ? chalk.yellow(' (truncated; more files exist beyond)')
    : '';
  console.log(
    `  ${chalk.bold(report.totalReachable.toString())} file(s) reachable within distance ${report.maxDistance}${truncatedNote}\n`,
  );
}

function printReachableFiles(report: ImpactReport): void {
  if (report.reachable.length === 0) {
    console.log(chalk.dim('  No reachable files.\n'));
    return;
  }
  printReachableGroups(report);
  printReachableOverflow(report);
}

function printReachableGroups(report: ImpactReport): void {
  let lastDistance = -1;
  for (const n of report.reachable.slice(0, 50)) {
    if (n.distance !== lastDistance) {
      console.log(chalk.bold(`  Distance ${n.distance}:`));
      lastDistance = n.distance;
    }
    console.log(`    ${chalk.cyan(n.file)}`);
  }
}

function printReachableOverflow(report: ImpactReport): void {
  if (report.reachable.length > 50) {
    console.log(chalk.dim(`    ... and ${report.reachable.length - 50} more\n`));
    return;
  }
  console.log('');
}
