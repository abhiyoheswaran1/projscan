import chalk from 'chalk';
import type { FileInspection } from '../types.js';

export function reportFileInspection(insp: FileInspection): void {
  console.log(header('File Report'));
  if (!insp.exists) {
    console.log(`\n  ${chalk.red('✗')} ${insp.reason ?? 'File unavailable.'}\n`);
    return;
  }
  printFileSummary(insp);
  printFileHotspot(insp);
  printFileIssues(insp);
  printFilePotentialIssues(insp);
  printFileImports(insp);
  printFileExports(insp);
  printFileFunctions(insp);
  printFileSuggestedActions(insp);
  console.log('');
}

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

function printFileSummary(insp: FileInspection): void {
  console.log(`\n  ${chalk.bold('File:')}     ${insp.relativePath}`);
  console.log(`  ${chalk.bold('Purpose:')}  ${insp.purpose}`);
  console.log(`  ${chalk.bold('Lines:')}    ${insp.lineCount}`);
  console.log(`  ${chalk.bold('Size:')}     ${formatSize(insp.sizeBytes)}`);
  if (typeof insp.cyclomaticComplexity === 'number') {
    console.log(`  ${chalk.bold('CC:')}       ${insp.cyclomaticComplexity}`);
  }
  if (typeof insp.fanIn === 'number' || typeof insp.fanOut === 'number') {
    console.log(
      `  ${chalk.bold('Coupling:')} fan-in ${insp.fanIn ?? '-'}, fan-out ${insp.fanOut ?? '-'}`,
    );
  }
}

function printFileHotspot(insp: FileInspection): void {
  if (!insp.hotspot) {
    console.log(
      chalk.dim('\n  No hotspot data (file is untouched in git window or outside analysis scope).'),
    );
    return;
  }
  const h = insp.hotspot;
  console.log(header('Risk'));
  console.log(`  ${chalk.bold('Risk Score:')}  ${chalk.bold(h.riskScore.toFixed(1))}`);
  console.log(`  ${chalk.bold('Commits:')}     ${h.churn}`);
  const primary = h.primaryAuthor
    ? ` (primary: ${formatAuthorEmail(h.primaryAuthor)}, ${Math.round(h.primaryAuthorShare * 100)}%)`
    : '';
  console.log(`  ${chalk.bold('Authors:')}     ${h.distinctAuthors}${primary}`);
  if (h.daysSinceLastChange !== null) {
    console.log(`  ${chalk.bold('Last change:')} ${h.daysSinceLastChange} days ago`);
  }
  if (h.busFactorOne) {
    console.log(`  ${chalk.red('⚠')} Bus factor 1 - only one author has touched this.`);
  }
  if (h.reasons.length > 0) {
    console.log(`  ${chalk.dim(h.reasons.join(', '))}`);
  }
}

function printFileIssues(insp: FileInspection): void {
  if (insp.issues.length === 0) return;
  console.log(header('Related Issues'));
  for (const issue of insp.issues) {
    console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
  }
}

function printFilePotentialIssues(insp: FileInspection): void {
  if (insp.potentialIssues.length === 0) return;
  console.log(header('Potential Issues'));
  for (const issue of insp.potentialIssues) {
    console.log(`  ${chalk.yellow('⚠')} ${issue}`);
  }
}

function printFileImports(insp: FileInspection): void {
  if (insp.imports.length === 0) return;
  console.log(header('Dependencies'));
  for (const imp of insp.imports.slice(0, 20)) {
    const prefix = imp.isRelative ? chalk.dim('(local)') : chalk.cyan('(package)');
    console.log(`  ${prefix} ${imp.source}`);
  }
  if (insp.imports.length > 20) {
    console.log(chalk.dim(`  ... and ${insp.imports.length - 20} more`));
  }
}

function printFileExports(insp: FileInspection): void {
  if (insp.exports.length === 0) return;
  console.log(header('Exports'));
  for (const exp of insp.exports) {
    console.log(`  ${chalk.dim('•')} ${chalk.bold(exp.name)} ${chalk.dim(`(${exp.type})`)}`);
  }
}

function printFileFunctions(insp: FileInspection): void {
  if (!insp.functions || insp.functions.length === 0) return;
  console.log(header('Functions (top by CC)'));
  const top = insp.functions.slice(0, 10);
  for (const fn of top) {
    const ccColor =
      fn.cyclomaticComplexity >= 10
        ? chalk.red
        : fn.cyclomaticComplexity >= 5
          ? chalk.yellow
          : chalk.dim;
    const fiStr =
      typeof fn.fanIn === 'number' ? `fan-in ${String(fn.fanIn).padStart(2)}` : '         ';
    console.log(
      `  ${ccColor(`CC ${String(fn.cyclomaticComplexity).padStart(3)}`)}  ${chalk.dim(fiStr)}  ${chalk.bold(fn.name)} ${chalk.dim(`L${fn.line}-${fn.endLine}`)}`,
    );
  }
  if (insp.functions.length > 10) {
    console.log(chalk.dim(`  ... and ${insp.functions.length - 10} more`));
  }
}

function printFileSuggestedActions(insp: FileInspection): void {
  if (!insp.suggestedNextActions || insp.suggestedNextActions.length === 0) return;
  console.log(header('Next Actions'));
  for (const action of insp.suggestedNextActions) {
    const command = action.command ? ` ${chalk.dim(action.command)}` : '';
    console.log(`  ${chalk.dim('•')} ${chalk.bold(action.label)}${command}`);
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAuthorEmail(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}
