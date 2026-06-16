import chalk from 'chalk';
import type { DependencyReport } from '../types.js';

export function reportDependencies(report: DependencyReport): void {
  console.log(header('Dependency Report'));
  printTotals(report);
  printProductionDependencies(report);
  printLicenseSummary(report);
  printInstalledSizes(report);
  printRisks(report);
  console.log('');
}

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

function printTotals(report: DependencyReport): void {
  console.log(`\n  Production:    ${chalk.bold(String(report.totalDependencies))} packages`);
  console.log(`  Development:   ${chalk.bold(String(report.totalDevDependencies))} packages`);
  console.log(
    `  Total:         ${chalk.bold(String(report.totalDependencies + report.totalDevDependencies))} packages`,
  );
}

function printProductionDependencies(report: DependencyReport): void {
  const deps = Object.entries(report.dependencies).sort(([a], [b]) => a.localeCompare(b));
  if (deps.length === 0) return;

  console.log(header('Production Dependencies'));
  for (const [name, version] of deps.slice(0, 25)) {
    console.log(`  ${chalk.dim('•')} ${name} ${chalk.dim(version)}`);
  }
  if (deps.length > 25) {
    console.log(`  ${chalk.dim(`... and ${deps.length - 25} more`)}`);
  }
}

function printLicenseSummary(report: DependencyReport): void {
  if (!report.licenses) return;

  console.log(header('License Summary'));
  const totalKnown = report.licenses.packages.length - report.licenses.unknown.length;
  console.log(`  Known:        ${chalk.bold(String(totalKnown))}`);
  console.log(`  Unknown:      ${chalk.bold(String(report.licenses.unknown.length))}`);
  console.log(`  Copyleft:     ${chalk.bold(String(report.licenses.copyleft.length))}`);
  for (const [license, count] of Object.entries(report.licenses.byLicense).slice(0, 8)) {
    console.log(`  ${chalk.dim('•')} ${license}: ${count}`);
  }
}

function printInstalledSizes(report: DependencyReport): void {
  if (!report.sizes || report.sizes.largest.length === 0) return;

  console.log(header('Installed Package Sizes'));
  console.log(`  Total:        ${chalk.bold(report.sizes.formattedTotal)}`);
  console.log(`  Missing:      ${chalk.bold(String(report.sizes.missing.length))}`);
  for (const entry of report.sizes.largest.slice(0, 8)) {
    const scope = entry.scope === 'production' ? 'prod' : 'dev';
    console.log(
      `  ${chalk.dim('•')} ${entry.name} ${chalk.dim(entry.version)} ${entry.formatted} ${chalk.dim(`(${scope})`)}`,
    );
  }
}

function printRisks(report: DependencyReport): void {
  if (report.risks.length === 0) return;

  console.log(header('Risks'));
  for (const risk of report.risks) {
    const icon = risk.severity === 'high' ? chalk.red('✗') : chalk.yellow('⚠');
    console.log(`  ${icon} ${risk.name}: ${risk.reason}`);
  }
}
