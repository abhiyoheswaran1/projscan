import chalk from 'chalk';
import type { UpgradePreview } from '../types.js';

const UPGRADE_DRIFT_COLORS = {
  major: chalk.red,
  minor: chalk.yellow,
  patch: chalk.blue,
  same: chalk.dim,
  unknown: chalk.dim,
};

export function reportUpgrade(preview: UpgradePreview): void {
  if (!preview.available) {
    console.log(chalk.yellow(`\n  ${preview.reason ?? 'Upgrade preview unavailable'}\n`));
    return;
  }

  console.log(header(`Upgrade Preview - ${preview.name}`));
  printUpgradeMetadata(preview);
  printBreakingMarkers(preview);
  printImporters(preview);
  printChangelog(preview);
}

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

function printUpgradeMetadata(preview: UpgradePreview): void {
  const drift = UPGRADE_DRIFT_COLORS[preview.drift] ?? chalk.dim;
  if (preview.ecosystem) {
    console.log(`  Ecosystem: ${chalk.dim(preview.ecosystem)}`);
  }
  const declaredSource = formatDeclaredSource(preview);
  const installedSource = formatInstalledSource(preview);
  console.log(`  Declared:  ${chalk.dim(preview.declared ?? '-')}${declaredSource}`);
  console.log(`  Installed: ${chalk.bold(preview.installed ?? '-')}${installedSource}`);
  console.log(`  Drift:     ${drift(preview.drift.toUpperCase())}`);
  console.log('');
}

function formatDeclaredSource(preview: UpgradePreview): string {
  if (!preview.declaredSource) return '';
  const line = preview.declaredLine ? `:${preview.declaredLine}` : '';
  const scope = preview.declaredScope ? `, ${preview.declaredScope}` : '';
  return chalk.dim(` (${preview.declaredSource}${line}${scope})`);
}

function formatInstalledSource(preview: UpgradePreview): string {
  if (!preview.installedSource) return '';
  const line = preview.installedLine ? `:${preview.installedLine}` : '';
  return chalk.dim(` (${preview.installedSource}${line})`);
}

function printBreakingMarkers(preview: UpgradePreview): void {
  if (preview.breakingMarkers.length === 0) {
    console.log(chalk.green('  ✓ No obvious breaking-change markers detected.\n'));
    return;
  }

  console.log(chalk.red.bold('  ⚠ Breaking-change markers detected:'));
  for (const marker of preview.breakingMarkers) {
    console.log(`    ${chalk.red('•')} ${marker.slice(0, 100)}`);
  }
  console.log('');
}

function printImporters(preview: UpgradePreview): void {
  if (preview.importers.length === 0) {
    console.log(chalk.dim('  No direct importers found in source.\n'));
    return;
  }

  console.log(chalk.bold(`  Importers (${preview.importers.length}):`));
  for (const file of preview.importers.slice(0, 15)) {
    console.log(`    ${chalk.dim('•')} ${file}`);
  }
  if (preview.importers.length > 15) {
    console.log(chalk.dim(`    … and ${preview.importers.length - 15} more`));
  }
  console.log('');
}

function printChangelog(preview: UpgradePreview): void {
  if (!preview.changelogExcerpt) {
    if (preview.ecosystem === 'python') {
      console.log(chalk.dim('  No package CHANGELOG loaded for offline Python previews.\n'));
      return;
    }
    console.log(chalk.dim('  No local CHANGELOG found (node_modules/<pkg>/CHANGELOG.md).\n'));
    return;
  }

  console.log(chalk.bold('  CHANGELOG excerpt:'));
  const lines = preview.changelogExcerpt.split('\n').slice(0, 40);
  for (const line of lines) console.log(`    ${chalk.dim(line)}`);
  console.log('');
}
