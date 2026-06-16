import chalk from 'chalk';
import type { PrDiffReport } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportPrDiff(report: PrDiffReport): void {
  console.log(header('PR Structural Diff'));
  if (!report.available) {
    console.log(`\n  ${chalk.yellow('⚠')} ${report.reason ?? 'PR diff unavailable.'}\n`);
    return;
  }
  printPrDiffRefs(report);
  printPrDiffFileTotals(report);
  printPrDiffAdded(report);
  printPrDiffRemoved(report);
  printPrDiffModified(report);
}

function printPrDiffRefs(report: PrDiffReport): void {
  console.log(
    chalk.dim(
      `\n  base ${report.base.ref} (${report.base.resolvedSha?.slice(0, 7) ?? '?'}) → head ${report.head.ref} (${report.head.resolvedSha?.slice(0, 7) ?? '?'})\n`,
    ),
  );
}

function printPrDiffFileTotals(report: PrDiffReport): void {
  const fileLabel = report.totalFilesChanged === 1 ? '' : 's';
  console.log(
    `  ${chalk.bold(report.totalFilesChanged.toString())} file${fileLabel} changed: ${chalk.green(`+${report.filesAdded.length}`)} ${chalk.red(`-${report.filesRemoved.length}`)} ${chalk.yellow(`~${report.filesModified.length}`)}\n`,
  );
}

function printPrDiffAdded(report: PrDiffReport): void {
  if (report.filesAdded.length === 0) return;
  console.log(chalk.bold('  Added:'));
  for (const f of report.filesAdded) console.log(`    ${chalk.green('+')} ${f}`);
  console.log('');
}

function printPrDiffRemoved(report: PrDiffReport): void {
  if (report.filesRemoved.length === 0) return;
  console.log(chalk.bold('  Removed:'));
  for (const f of report.filesRemoved) console.log(`    ${chalk.red('-')} ${f}`);
  console.log('');
}

function printPrDiffModified(report: PrDiffReport): void {
  if (report.filesModified.length === 0) return;
  console.log(chalk.bold('  Modified:'));
  for (const m of report.filesModified) printPrDiffModifiedFile(m);
  console.log('');
}

function printPrDiffModifiedFile(m: PrDiffReport['filesModified'][number]): void {
  const ccDelta = m.cyclomaticDelta;
  const fiDelta = m.fanInDelta;
  const ccStr = ccDelta === null ? '' : `, ΔCC ${signed(ccDelta)}`;
  const finStr = fiDelta === null || fiDelta === 0 ? '' : `, Δfan-in ${signed(fiDelta)}`;
  console.log(`    ${chalk.yellow('~')} ${chalk.cyan(m.relativePath)}${chalk.dim(ccStr + finStr)}`);
  if (m.exportsAdded.length > 0) {
    console.log(`      ${chalk.green('+exports:')} ${m.exportsAdded.join(', ')}`);
  }
  if (m.exportsRemoved.length > 0) {
    console.log(`      ${chalk.red('-exports:')} ${m.exportsRemoved.join(', ')}`);
  }
  if (m.exportsRenamed.length > 0) {
    const pairs = m.exportsRenamed.map((r) => `${r.from} → ${r.to}`).join(', ');
    console.log(`      ${chalk.yellow('~exports:')} ${pairs}`);
  }
  if (m.importsAdded.length > 0) {
    console.log(`      ${chalk.green('+imports:')} ${m.importsAdded.join(', ')}`);
  }
  if (m.importsRemoved.length > 0) {
    console.log(`      ${chalk.red('-imports:')} ${m.importsRemoved.join(', ')}`);
  }
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}
