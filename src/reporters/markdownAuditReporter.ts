import type { AuditReport } from '../types.js';

export function reportAuditMarkdown(report: AuditReport): void {
  const lines: string[] = [];
  lines.push('# Vulnerability Audit');
  lines.push('');
  if (!report.available) {
    lines.push(`_${report.reason ?? 'audit unavailable'}_`);
    console.log(lines.join('\n'));
    return;
  }

  const s = report.summary;
  const total = s.critical + s.high + s.moderate + s.low + s.info;
  lines.push(
    `**${total}** findings - ${s.critical} critical · ${s.high} high · ${s.moderate} moderate · ${s.low} low · ${s.info} info`,
  );
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('_No known vulnerabilities._');
    console.log(lines.join('\n'));
    return;
  }

  lines.push('| Severity | Package | Title | Fix |');
  lines.push('| --- | --- | --- | --- |');
  for (const f of report.findings) {
    const title = f.url ? `[${f.title}](${f.url})` : f.title;
    lines.push(`| ${f.severity} | \`${f.name}\` | ${title} | ${f.fixAvailable ? 'yes' : 'no'} |`);
  }

  console.log(lines.join('\n'));
}
