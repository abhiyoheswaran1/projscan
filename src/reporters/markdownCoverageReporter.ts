import type { CoverageJoinedHotspot, CoverageJoinedReport } from '../types.js';

export function reportCoverageMarkdown(report: CoverageJoinedReport): void {
  const lines: string[] = ['# Coverage × Hotspots', ''];
  if (!report.available) {
    appendUnavailableCoverage(lines, report);
  } else {
    appendCoverageBody(lines, report);
  }
  console.log(lines.join('\n'));
}

function appendUnavailableCoverage(lines: string[], report: CoverageJoinedReport): void {
  lines.push(`_${report.reason ?? 'unavailable'}_`);
}

function appendCoverageBody(lines: string[], report: CoverageJoinedReport): void {
  appendCoverageSource(lines, report);
  if (report.entries.length === 0) {
    lines.push('_No hotspots intersected with coverage data._');
    return;
  }

  lines.push('| Priority | Coverage | Risk | Churn | File | Reasons |');
  lines.push('| ---: | ---: | ---: | ---: | --- | --- |');
  for (const entry of report.entries) lines.push(coverageEntryRow(entry));
}

function appendCoverageSource(lines: string[], report: CoverageJoinedReport): void {
  if (!report.coverageSourceFile) return;
  lines.push(`_Source: \`${report.coverageSourceFile}\` (${report.coverageSource})_`);
  lines.push('');
}

function coverageEntryRow(entry: CoverageJoinedHotspot): string {
  return `| ${entry.priority.toFixed(1)} | ${coverageCell(entry)} | ${entry.riskScore.toFixed(1)} | ${entry.churn} | \`${entry.relativePath}\` | ${reasonsCell(entry)} |`;
}

function coverageCell(entry: CoverageJoinedHotspot): string {
  return entry.coverage === null ? '-' : `${entry.coverage.toFixed(0)}%`;
}

function reasonsCell(entry: CoverageJoinedHotspot): string {
  return entry.reasons.length > 0 ? entry.reasons.join(', ') : '-';
}
