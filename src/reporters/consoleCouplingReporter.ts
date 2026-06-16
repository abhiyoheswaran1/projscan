import chalk from 'chalk';
import type { CouplingReport } from '../types.js';

export function reportCoupling(report: CouplingReport): void {
  console.log(header('Coupling + Cycles'));

  if (report.totalFiles === 0) {
    console.log(
      `\n  ${chalk.yellow('⚠')} No files in the code graph (no language adapter matched).\n`,
    );
    return;
  }

  printGraphTotals(report);
  printCycles(report);
  printCrossPackageEdges(report);
  printFiles(report);
}

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

function printGraphTotals(report: CouplingReport): void {
  const xpkg = report.totalCrossPackageEdges;
  console.log(
    chalk.dim(
      `\n  ${report.totalFiles} file${report.totalFiles === 1 ? '' : 's'} in graph · ${report.totalCycles} cycle${report.totalCycles === 1 ? '' : 's'}${xpkg > 0 ? ` · ${xpkg} cross-package edge${xpkg === 1 ? '' : 's'}` : ''}\n`,
    ),
  );
}

function printCycles(report: CouplingReport): void {
  if (report.cycles.length === 0) return;

  console.log(chalk.bold('  Import cycles:'));
  for (const cycle of report.cycles) {
    console.log(
      `    ${chalk.red('●')} cycle of ${cycle.size} files: ${cycle.files.join(' → ')} → …`,
    );
  }
  console.log('');
}

function printCrossPackageEdges(report: CouplingReport): void {
  if (report.crossPackageEdges.length === 0) return;

  console.log(chalk.bold('  Cross-package edges:'));
  for (const edge of report.crossPackageEdges.slice(0, 25)) {
    console.log(
      `    ${chalk.yellow('→')} ${chalk.cyan(edge.from.file)} ${chalk.dim(`(${edge.from.package})`)}  →  ${chalk.cyan(edge.to.file)} ${chalk.dim(`(${edge.to.package})`)}`,
    );
  }
  if (report.crossPackageEdges.length > 25) {
    console.log(chalk.dim(`    … and ${report.crossPackageEdges.length - 25} more`));
  }
  console.log('');
}

function printFiles(report: CouplingReport): void {
  if (report.files.length === 0) return;

  console.log(chalk.bold('  Files (sorted by request):'));
  const colHeader = `    ${'fan-in'.padStart(6)}  ${'fan-out'.padStart(7)}  ${'instab'.padStart(6)}  file`;
  console.log(chalk.dim(colHeader));
  for (const file of report.files) {
    console.log(
      `    ${String(file.fanIn).padStart(6)}  ${String(file.fanOut).padStart(7)}  ${file.instability.toFixed(2).padStart(6)}  ${chalk.cyan(file.relativePath)}`,
    );
  }
  console.log('');
}
