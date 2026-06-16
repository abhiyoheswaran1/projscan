import type { ImpactReport } from '../types.js';

export function reportImpactMarkdown(report: ImpactReport): void {
  const lines: string[] = [`# Impact: ${report.target.kind} \`${report.target.value}\``, ''];
  if (!report.available) {
    appendUnavailableImpact(lines, report);
  } else {
    appendAvailableImpact(lines, report);
  }
  console.log(lines.join('\n'));
}

function appendUnavailableImpact(lines: string[], report: ImpactReport): void {
  lines.push(`> ${report.reason ?? 'Impact unavailable.'}`);
}

function appendAvailableImpact(lines: string[], report: ImpactReport): void {
  appendSymbolImpactDetails(lines, report);
  appendReachableSummary(lines, report);
  appendReachableFiles(lines, report);
}

function appendSymbolImpactDetails(lines: string[], report: ImpactReport): void {
  if (report.target.kind !== 'symbol') return;
  lines.push(
    `_definitions: ${report.definitionFiles.length} · direct callers: ${report.directCallers.length}_`,
    '',
  );
  appendDefinitionFiles(lines, report);
}

function appendDefinitionFiles(lines: string[], report: ImpactReport): void {
  if (report.definitionFiles.length === 0) return;
  lines.push('## Defined in', '');
  for (const f of report.definitionFiles) lines.push(`- \`${f}\``);
  lines.push('');
}

function appendReachableSummary(lines: string[], report: ImpactReport): void {
  lines.push(
    `**${report.totalReachable}** file(s) reachable within distance ${report.maxDistance}${report.truncated ? ' (truncated; more files exist beyond)' : ''}.`,
    '',
  );
}

function appendReachableFiles(lines: string[], report: ImpactReport): void {
  if (report.reachable.length === 0) {
    lines.push('_No reachable files._');
    return;
  }
  lines.push('| Distance | File |', '| ---: | --- |');
  for (const n of report.reachable.slice(0, 200)) {
    lines.push(`| ${n.distance} | \`${n.file}\` |`);
  }
  appendReachableOverflow(lines, report);
}

function appendReachableOverflow(lines: string[], report: ImpactReport): void {
  if (report.reachable.length > 200) {
    lines.push('', `_... and ${report.reachable.length - 200} more_`);
  }
}
