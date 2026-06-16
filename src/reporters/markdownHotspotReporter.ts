import type { HotspotReport } from '../types.js';

type HotspotEntry = HotspotReport['hotspots'][number];

export function reportHotspotsMarkdown(report: HotspotReport): void {
  const lines: string[] = ['# Project Hotspots', ''];

  if (!report.available) {
    appendUnavailableHotspots(lines, report);
    console.log(lines.join('\n'));
    return;
  }

  appendHotspotBody(lines, report);
  console.log(lines.join('\n'));
}

function appendUnavailableHotspots(lines: string[], report: HotspotReport): void {
  lines.push(`> ${report.reason ?? 'Hotspot analysis unavailable.'}`);
}

function appendHotspotBody(lines: string[], report: HotspotReport): void {
  const { since, commitsScanned } = report.window;
  lines.push(
    `_Scanned **${commitsScanned}** commit(s) since **${since}** · ranked **${report.totalFilesRanked}** file(s)_`,
  );
  lines.push('');

  if (report.hotspots.length === 0) {
    lines.push('No hotspots detected.');
    return;
  }

  appendHotspotRows(lines, report.hotspots);
}

function appendHotspotRows(lines: string[], hotspots: HotspotEntry[]): void {
  lines.push('| # | Score | File | Churn | CC | Lines | Issues | Reasons |');
  lines.push('| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |');
  for (let i = 0; i < hotspots.length; i++) {
    lines.push(hotspotRow(i, hotspots[i]));
  }
}

function hotspotRow(index: number, hotspot: HotspotEntry): string {
  const reasons = hotspot.reasons.length > 0 ? hotspot.reasons.join(', ') : '-';
  const cc =
    typeof hotspot.cyclomaticComplexity === 'number' ? String(hotspot.cyclomaticComplexity) : '-';
  return `| ${index + 1} | ${hotspot.riskScore.toFixed(1)} | \`${hotspot.relativePath}\` | ${hotspot.churn} | ${cc} | ${hotspot.lineCount} | ${hotspot.issueCount} | ${reasons} |`;
}
