import type { ReviewReport } from '../types/review.js';

export function reportReviewMarkdown(report: ReviewReport): void {
  const lines: string[] = ['# PR Review', ''];
  if (!report.available) {
    lines.push(`> ${report.reason ?? 'Review unavailable.'}`);
    console.log(lines.join('\n'));
    return;
  }
  appendReviewHeader(lines, report);
  appendReviewSummary(lines, report);
  appendReviewChangedFiles(lines, report);
  appendReviewCycles(lines, report);
  appendReviewRiskyFunctions(lines, report);
  appendReviewDependencyChanges(lines, report);
  console.log(lines.join('\n'));
}

function appendReviewHeader(lines: string[], report: ReviewReport): void {
  const verdictBadge =
    report.verdict === 'block' ? '🚫 BLOCK' : report.verdict === 'review' ? '👀 REVIEW' : '✅ OK';
  lines.push(
    `_base **${report.base.ref}** (${report.base.resolvedSha?.slice(0, 7) ?? '?'}) → head **${report.head.ref}** (${report.head.resolvedSha?.slice(0, 7) ?? '?'})_`,
    '',
    `**Verdict:** ${verdictBadge}`,
    '',
  );
}

function appendReviewSummary(lines: string[], report: ReviewReport): void {
  if (report.summary.length === 0) return;
  for (const s of report.summary) lines.push(`- ${s}`);
  lines.push('');
}

function appendReviewChangedFiles(lines: string[], report: ReviewReport): void {
  if (report.changedFiles.length === 0) return;
  lines.push('## Changed files', '');
  lines.push('| File | Status | Risk | CC | ΔCC |');
  lines.push('| --- | --- | ---: | ---: | ---: |');
  for (const f of report.changedFiles.slice(0, 50)) {
    const risk = f.riskScore !== null ? f.riskScore.toFixed(1) : '-';
    const cc = f.cyclomaticComplexity !== null ? String(f.cyclomaticComplexity) : '-';
    const dcc = f.cyclomaticDelta === null ? '-' : signed(f.cyclomaticDelta);
    lines.push(`| \`${f.relativePath}\` | ${f.status} | ${risk} | ${cc} | ${dcc} |`);
  }
  if (report.changedFiles.length > 50) {
    lines.push('', `_... and ${report.changedFiles.length - 50} more files_`);
  }
  lines.push('');
}

function appendReviewCycles(lines: string[], report: ReviewReport): void {
  if (report.newCycles.length === 0) return;
  lines.push('## New / expanded import cycles', '');
  for (const c of report.newCycles) {
    lines.push(
      `- **${c.classification}** (${c.size} files): ${c.files.map((f) => `\`${f}\``).join(' → ')}`,
    );
  }
  lines.push('');
}

function appendReviewRiskyFunctions(lines: string[], report: ReviewReport): void {
  if (report.riskyFunctions.length === 0) return;
  lines.push('## Risky functions', '');
  lines.push('| Function | File | CC | Reason | Δ from base |');
  lines.push('| --- | --- | ---: | --- | --- |');
  for (const fn of report.riskyFunctions.slice(0, 30)) {
    const baseInfo = fn.baseCc === null ? 'new' : `${fn.baseCc} → ${fn.cyclomaticComplexity}`;
    lines.push(
      `| \`${fn.name}\` | \`${fn.file}\`:L${fn.line} | ${fn.cyclomaticComplexity} | ${fn.reason} | ${baseInfo} |`,
    );
  }
  lines.push('');
}

function appendReviewDependencyChanges(lines: string[], report: ReviewReport): void {
  if (report.dependencyChanges.length === 0) return;
  lines.push('## Dependency changes', '');
  for (const d of report.dependencyChanges) {
    const wsLabel = d.workspace ? ` (${d.workspace})` : '';
    lines.push(`### \`${d.manifestFile}\`${wsLabel}`, '');
    for (const a of d.added) lines.push(`- ➕ \`${a.name}@${a.version}\` (${a.kind})`);
    for (const r of d.removed) lines.push(`- ➖ \`${r.name}@${r.version}\` (${r.kind})`);
    for (const b of d.bumped)
      lines.push(`- 🔄 \`${b.name}\`: \`${b.from}\` → \`${b.to}\` (${b.kind})`);
    lines.push('');
  }
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}
