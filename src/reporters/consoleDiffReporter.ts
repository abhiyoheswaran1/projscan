import chalk from 'chalk';
import type { DiffResult, HotspotDelta } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportDiff(diff: DiffResult): void {
  console.log(header('Health Diff'));
  printDiffScoreLine(diff);
  printDiffIssueLists(diff);
  printHotspotDiff(diff);
  console.log(`\n  Baseline: ${chalk.dim(diff.before.timestamp)}`);
  console.log('');
}

function printDiffScoreLine(diff: DiffResult): void {
  const arrow =
    diff.scoreDelta > 0 ? chalk.green('↑') : diff.scoreDelta < 0 ? chalk.red('↓') : chalk.dim('-');
  const delta = diff.scoreDelta > 0 ? `+${diff.scoreDelta}` : String(diff.scoreDelta);
  console.log(`\n  Score: ${diff.before.score} → ${diff.after.score} (${delta})  ${arrow}`);
  console.log(`  Grade: ${diff.before.grade} → ${diff.after.grade}`);
}

function printDiffIssueLists(diff: DiffResult): void {
  if (diff.resolvedIssues.length > 0) {
    console.log(`\n  ${chalk.green('✓')} Resolved (${diff.resolvedIssues.length}):`);
    for (const title of diff.resolvedIssues) console.log(`    ${chalk.green('-')} ${title}`);
  }
  if (diff.newIssues.length > 0) {
    console.log(`\n  ${chalk.red('✗')} New (${diff.newIssues.length}):`);
    for (const title of diff.newIssues) console.log(`    ${chalk.red('-')} ${title}`);
  }
  if (diff.resolvedIssues.length === 0 && diff.newIssues.length === 0) {
    console.log(`\n  ${chalk.dim('No change in issues.')}`);
  }
}

function printHotspotDiff(diff: DiffResult): void {
  if (!diff.hotspotDiff) return;
  const hd = diff.hotspotDiff;
  const total = hd.rose.length + hd.fell.length + hd.appeared.length + hd.resolved.length;
  if (total === 0) return;
  console.log(header('Hotspot Changes'));
  printHotspotRose(hd.rose);
  printHotspotAppeared(hd.appeared);
  printHotspotFell(hd.fell);
  printHotspotResolved(hd.resolved);
}

function printHotspotRose(rose: HotspotDelta[]): void {
  if (rose.length === 0) return;
  console.log(`\n  ${chalk.red('▲')} Worsening (${rose.length}):`);
  for (const delta of rose.slice(0, 10)) {
    console.log(
      `    ${chalk.red('+' + delta.scoreDelta.toFixed(1))}  ${delta.relativePath}  ${chalk.dim(`${delta.beforeScore?.toFixed(1)} → ${delta.afterScore?.toFixed(1)}`)}`,
    );
  }
}

function printHotspotAppeared(appeared: HotspotDelta[]): void {
  if (appeared.length === 0) return;
  console.log(`\n  ${chalk.yellow('●')} Newly risky (${appeared.length}):`);
  for (const delta of appeared.slice(0, 10)) {
    console.log(`    ${chalk.yellow(delta.afterScore?.toFixed(1) ?? '?')}  ${delta.relativePath}`);
  }
}

function printHotspotFell(fell: HotspotDelta[]): void {
  if (fell.length === 0) return;
  console.log(`\n  ${chalk.green('▼')} Improving (${fell.length}):`);
  for (const delta of fell.slice(0, 10)) {
    console.log(
      `    ${chalk.green(delta.scoreDelta.toFixed(1))}  ${delta.relativePath}  ${chalk.dim(`${delta.beforeScore?.toFixed(1)} → ${delta.afterScore?.toFixed(1)}`)}`,
    );
  }
}

function printHotspotResolved(resolved: HotspotDelta[]): void {
  if (resolved.length === 0) return;
  console.log(`\n  ${chalk.green('✓')} No longer tracked (${resolved.length}):`);
  for (const delta of resolved.slice(0, 5)) {
    console.log(`    ${chalk.green('-')}  ${delta.relativePath}`);
  }
}
