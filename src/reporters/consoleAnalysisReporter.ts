import chalk from 'chalk';
import type { AnalysisReport } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return chalk.red('✗');
    case 'warning':
      return chalk.yellow('⚠');
    case 'info':
      return chalk.blue('ℹ');
    default:
      return chalk.dim('·');
  }
}

function bar(percentage: number, width = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

export function reportAnalysis(report: AnalysisReport): void {
  console.log(header('ProjScan Project Report'));
  printProject(report);
  printLanguages(report);
  printStructure(report);
  printIssues(report);
  printSuggestions(report);
  console.log('');
}

function printProject(report: AnalysisReport): void {
  console.log(header('Project'));
  console.log(`  Name:          ${chalk.bold(report.projectName)}`);
  console.log(`  Language:      ${chalk.bold(report.languages.primary)}`);

  const frameworkNames = report.frameworks.frameworks.map((f) => f.name).join(', ');
  if (frameworkNames) {
    console.log(`  Frameworks:    ${chalk.bold(frameworkNames)}`);
  }

  if (report.frameworks.packageManager !== 'unknown') {
    console.log(`  Pkg Manager:   ${report.frameworks.packageManager}`);
  }

  if (report.dependencies) {
    console.log(
      `  Dependencies:  ${report.dependencies.totalDependencies} prod, ${report.dependencies.totalDevDependencies} dev`,
    );
  }

  console.log(`  Files:         ${report.scan.totalFiles}`);
  console.log(`  Directories:   ${report.scan.totalDirectories}`);
  console.log(`  Scan Time:     ${report.scan.scanDurationMs.toFixed(0)}ms`);
}

function printLanguages(report: AnalysisReport): void {
  const langEntries = Object.values(report.languages.languages)
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 8);

  if (langEntries.length === 0) return;

  console.log(header('Languages'));
  for (const lang of langEntries) {
    const pct = lang.percentage.toFixed(1).padStart(5);
    console.log(`  ${bar(lang.percentage)} ${pct}%  ${lang.name} (${lang.fileCount} files)`);
  }
}

function printStructure(report: AnalysisReport): void {
  if (report.scan.directoryTree.children.length === 0) return;

  console.log(header('Structure'));
  for (const child of report.scan.directoryTree.children.slice(0, 12)) {
    const count = chalk.dim(`(${child.totalFileCount} files)`);
    console.log(`  ${chalk.bold(child.name + '/')}  ${count}`);
  }
}

function printIssues(report: AnalysisReport): void {
  if (report.issues.length === 0) return;

  console.log(header('Issues'));
  for (const issue of report.issues) {
    console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
  }
}

function printSuggestions(report: AnalysisReport): void {
  const fixableIssues = report.issues.filter((i) => i.fixAvailable);
  if (fixableIssues.length === 0) return;

  console.log(header('Suggestions'));
  for (const issue of fixableIssues) {
    console.log(`  ${chalk.green('•')} ${issue.description}`);
  }
  console.log(`\n  Run ${chalk.bold.cyan('projscan fix')} to auto-fix these issues.`);
}
