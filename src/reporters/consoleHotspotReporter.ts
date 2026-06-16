import chalk from 'chalk';
import type { HotspotReport } from '../types.js';

export function reportHotspots(report: HotspotReport): void {
  console.log(header('Project Hotspots'));

  if (!report.available) {
    printUnavailable(report);
    return;
  }

  if (report.hotspots.length === 0) {
    printEmpty(report);
    return;
  }

  printWindowSummary(report);
  printHotspotRows(report);
  printAcceptedLegend(report);
  printDrilldownTip();
}

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

function bar(percentage: number, width = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

function printUnavailable(report: HotspotReport): void {
  console.log(`\n  ${chalk.yellow('⚠')} ${report.reason ?? 'Hotspot analysis unavailable.'}\n`);
}

function printEmpty(report: HotspotReport): void {
  const commitLabel = commitCountLabel(report.window.commitsScanned);
  console.log(`\n  ${chalk.green('✓')} No hotspots detected.`);
  console.log(chalk.dim(`  Scanned ${commitLabel} since ${report.window.since}.\n`));
}

function printWindowSummary(report: HotspotReport): void {
  const commitLabel = commitCountLabel(report.window.commitsScanned);
  const fileLabel = fileCountLabel(report.totalFilesRanked);
  console.log(chalk.dim(`\n  ${commitLabel} since ${report.window.since} · ${fileLabel} ranked\n`));
}

function commitCountLabel(count: number): string {
  return `${count} commit${count === 1 ? '' : 's'}`;
}

function fileCountLabel(count: number): string {
  return `${count} file${count === 1 ? '' : 's'}`;
}

function printHotspotRows(report: HotspotReport): void {
  const maxScore = report.hotspots[0]?.riskScore ?? 1;
  for (let i = 0; i < report.hotspots.length; i++) {
    const hotspot = report.hotspots[i];
    const rank = chalk.bold(String(i + 1).padStart(2, ' ') + '.');
    const scoreLabel = chalk.bold(hotspot.riskScore.toFixed(1).padStart(5, ' '));
    const barPct = Math.min(100, Math.round((hotspot.riskScore / maxScore) * 100));
    const acceptedTag = hotspot.accepted ? ` ${chalk.dim('[accepted]')}` : '';
    console.log(
      `  ${rank} ${scoreLabel}  ${bar(barPct, 14)}  ${chalk.cyan(hotspot.relativePath)}${acceptedTag}`,
    );
    console.log(`       ${chalk.dim(reasonText(hotspot.reasons))}`);
  }
}

function reasonText(reasons: string[]): string {
  return reasons.length > 0 ? reasons.join(', ') : 'ranked by risk';
}

function printAcceptedLegend(report: HotspotReport): void {
  if (!report.hotspots.some((hotspot) => hotspot.accepted)) return;

  console.log(
    chalk.dim(
      `\n  ${chalk.cyan('▲')} [accepted] = top-5 for ≥ 5 runs over ≥ 7 days without improving (Project Memory).`,
    ),
  );
}

function printDrilldownTip(): void {
  console.log(
    chalk.dim(`\n  Tip: run ${chalk.bold.cyan('projscan file <file>')} to drill into a hotspot.\n`),
  );
}
