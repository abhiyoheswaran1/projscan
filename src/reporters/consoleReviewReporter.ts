import chalk from 'chalk';
import type { ReviewReport } from '../types/review.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportReview(report: ReviewReport): void {
  console.log(header('PR Review'));
  if (!report.available) {
    console.log(`\n  ${chalk.yellow('⚠')} ${report.reason ?? 'Review unavailable.'}\n`);
    return;
  }
  printReviewRefs(report);
  printReviewVerdict(report);
  printReviewSummary(report);
  printReviewChangedFiles(report);
  printReviewCycles(report);
  printReviewRiskyFunctions(report);
  printReviewDependencyChanges(report);
}

function printReviewRefs(report: ReviewReport): void {
  console.log(
    chalk.dim(
      `\n  base ${report.base.ref} (${report.base.resolvedSha?.slice(0, 7) ?? '?'}) → head ${report.head.ref} (${report.head.resolvedSha?.slice(0, 7) ?? '?'})\n`,
    ),
  );
}

function printReviewVerdict(report: ReviewReport): void {
  const verdictColor =
    report.verdict === 'block'
      ? chalk.red
      : report.verdict === 'review'
        ? chalk.yellow
        : chalk.green;
  const verdictLabel =
    report.verdict === 'block' ? '🚫 BLOCK' : report.verdict === 'review' ? '👀 REVIEW' : '✅ OK';
  console.log(`  ${chalk.bold('Verdict:')} ${verdictColor(verdictLabel)}\n`);
}

function printReviewSummary(report: ReviewReport): void {
  for (const s of report.summary) {
    console.log(`  ${chalk.dim('•')} ${s}`);
  }
  if (report.summary.length > 0) console.log('');
}

function printReviewChangedFiles(report: ReviewReport): void {
  if (report.changedFiles.length === 0) return;
  console.log(chalk.bold('  Changed files (top by risk):'));
  for (const f of report.changedFiles.slice(0, 15)) {
    const risk = f.riskScore !== null ? f.riskScore.toFixed(1).padStart(6) : '   -  ';
    const cc = f.cyclomaticComplexity !== null ? String(f.cyclomaticComplexity).padStart(3) : '  -';
    const dcc = f.cyclomaticDelta === null ? '   ' : signed(f.cyclomaticDelta).padStart(3);
    const statusColor =
      f.status === 'added' ? chalk.green : f.status === 'removed' ? chalk.red : chalk.yellow;
    console.log(
      `    ${statusColor(f.status.padEnd(8))} risk ${risk}  CC ${cc} (Δ${dcc})  ${chalk.cyan(f.relativePath)}`,
    );
  }
  if (report.changedFiles.length > 15) {
    console.log(chalk.dim(`    ... and ${report.changedFiles.length - 15} more`));
  }
  console.log('');
}

function printReviewCycles(report: ReviewReport): void {
  if (report.newCycles.length === 0) return;
  console.log(chalk.bold(`  New / expanded cycles (${report.newCycles.length}):`));
  for (const c of report.newCycles.slice(0, 5)) {
    const tag = c.classification === 'new' ? chalk.red('NEW') : chalk.yellow('EXP');
    console.log(`    ${tag} (${c.size}): ${c.files.join(' → ')}`);
  }
  if (report.newCycles.length > 5) {
    console.log(chalk.dim(`    ... and ${report.newCycles.length - 5} more`));
  }
  console.log('');
}

function printReviewRiskyFunctions(report: ReviewReport): void {
  if (report.riskyFunctions.length === 0) return;
  console.log(chalk.bold(`  Risky functions (${report.riskyFunctions.length}):`));
  for (const fn of report.riskyFunctions.slice(0, 10)) {
    const cc = fn.cyclomaticComplexity >= 15 ? chalk.red : chalk.yellow;
    const transition = fn.baseCc === null ? `(new)` : `(${fn.baseCc} → ${fn.cyclomaticComplexity})`;
    console.log(
      `    ${cc(`CC ${String(fn.cyclomaticComplexity).padStart(3)}`)} ${chalk.bold(fn.name)}  ${chalk.dim(`${fn.file}:${fn.line}`)} ${chalk.dim(`[${fn.reason}] ${transition}`)}`,
    );
  }
  if (report.riskyFunctions.length > 10) {
    console.log(chalk.dim(`    ... and ${report.riskyFunctions.length - 10} more`));
  }
  console.log('');
}

function printReviewDependencyChanges(report: ReviewReport): void {
  if (report.dependencyChanges.length === 0) return;
  console.log(chalk.bold('  Dependency changes:'));
  for (const d of report.dependencyChanges) {
    const wsLabel = d.workspace ? ` (${d.workspace})` : '';
    console.log(`    ${chalk.cyan(d.manifestFile)}${chalk.dim(wsLabel)}`);
    for (const a of d.added)
      console.log(`      ${chalk.green('+')} ${a.name}@${a.version} ${chalk.dim(`(${a.kind})`)}`);
    for (const r of d.removed)
      console.log(`      ${chalk.red('-')} ${r.name}@${r.version} ${chalk.dim(`(${r.kind})`)}`);
    for (const b of d.bumped)
      console.log(
        `      ${chalk.yellow('~')} ${b.name}: ${b.from} → ${b.to} ${chalk.dim(`(${b.kind})`)}`,
      );
  }
  console.log('');
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
