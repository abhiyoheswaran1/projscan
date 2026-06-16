import type { PrDiffReport } from '../types.js';

export function reportPrDiffMarkdown(report: PrDiffReport): void {
  const lines: string[] = ['# PR Structural Diff', ''];
  if (!report.available) {
    lines.push(`> ${report.reason ?? 'PR diff unavailable.'}`);
    console.log(lines.join('\n'));
    return;
  }
  appendPrDiffHeader(lines, report);
  appendPrDiffAdded(lines, report);
  appendPrDiffRemoved(lines, report);
  appendPrDiffModified(lines, report);
  console.log(lines.join('\n'));
}

function appendPrDiffHeader(lines: string[], report: PrDiffReport): void {
  lines.push(
    `_base **${report.base.ref}** (${report.base.resolvedSha?.slice(0, 7) ?? '?'}) → head **${report.head.ref}** (${report.head.resolvedSha?.slice(0, 7) ?? '?'})_`,
    '',
    `**${report.totalFilesChanged}** file(s) changed: +${report.filesAdded.length} added, -${report.filesRemoved.length} removed, ~${report.filesModified.length} modified`,
    '',
  );
}

function appendPrDiffAdded(lines: string[], report: PrDiffReport): void {
  if (report.filesAdded.length === 0) return;
  lines.push('## Added', '');
  for (const f of report.filesAdded) lines.push(`- \`${f}\``);
  lines.push('');
}

function appendPrDiffRemoved(lines: string[], report: PrDiffReport): void {
  if (report.filesRemoved.length === 0) return;
  lines.push('## Removed', '');
  for (const f of report.filesRemoved) lines.push(`- \`${f}\``);
  lines.push('');
}

function appendPrDiffModified(lines: string[], report: PrDiffReport): void {
  if (report.filesModified.length === 0) return;
  lines.push('## Modified', '');
  for (const m of report.filesModified) appendPrDiffModifiedEntry(lines, m);
}

function appendPrDiffModifiedEntry(
  lines: string[],
  m: PrDiffReport['filesModified'][number],
): void {
  const ccDelta = m.cyclomaticDelta;
  const fiDelta = m.fanInDelta;
  const dCC = ccDelta === null ? '' : ` · ΔCC ${signed(ccDelta)}`;
  const dFI = fiDelta === null || fiDelta === 0 ? '' : ` · Δfan-in ${signed(fiDelta)}`;
  lines.push(`### \`${m.relativePath}\`${dCC}${dFI}`, '');
  if (m.exportsAdded.length > 0)
    lines.push(`- **+exports:** ${m.exportsAdded.map((s) => `\`${s}\``).join(', ')}`);
  if (m.exportsRemoved.length > 0)
    lines.push(`- **-exports:** ${m.exportsRemoved.map((s) => `\`${s}\``).join(', ')}`);
  if (m.exportsRenamed.length > 0) {
    const pairs = m.exportsRenamed.map((r) => `\`${r.from}\` → \`${r.to}\``).join(', ');
    lines.push(`- **~exports:** ${pairs}`);
  }
  if (m.importsAdded.length > 0)
    lines.push(`- **+imports:** ${m.importsAdded.map((s) => `\`${s}\``).join(', ')}`);
  if (m.importsRemoved.length > 0)
    lines.push(`- **-imports:** ${m.importsRemoved.map((s) => `\`${s}\``).join(', ')}`);
  lines.push('');
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}
