import type { OutdatedReport } from '../types.js';

export function reportOutdatedMarkdown(report: OutdatedReport): void {
  const lines: string[] = ['# Outdated Packages', ''];

  if (!report.available) {
    lines.push(`_${report.reason ?? 'unavailable'}_`);
    console.log(lines.join('\n'));
    return;
  }

  appendOutdatedBody(lines, report);
  console.log(lines.join('\n'));
}

function appendOutdatedBody(lines: string[], report: OutdatedReport): void {
  const drifting = report.packages.filter(isDriftedPackage);
  lines.push(`**${report.totalPackages}** declared · **${drifting.length}** drifted`);
  lines.push('');

  if (drifting.length === 0) {
    lines.push('_All declared packages match installed versions._');
    return;
  }

  appendDriftRows(lines, drifting);
}

function isDriftedPackage(packageInfo: OutdatedReport['packages'][number]): boolean {
  return packageInfo.drift !== 'same' && packageInfo.drift !== 'unknown';
}

function appendDriftRows(lines: string[], drifting: OutdatedReport['packages']): void {
  lines.push('| Package | Scope | Declared | Installed | Drift |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const p of drifting) {
    lines.push(
      `| \`${p.name}\` | ${p.scope === 'devDependency' ? 'dev' : 'prod'} | ${p.declared} | ${p.installed ?? '-'} | ${p.drift} |`,
    );
  }
}
