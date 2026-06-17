import type { ReviewReport } from '../types/review.js';
import { escapeHtml, htmlShell, signed } from './htmlShared.js';

export function reportReviewHtml(report: ReviewReport): void {
  if (!report.available) {
    console.log(unavailableReviewHtml(report));
    return;
  }
  console.log(htmlShell(`PR Review (${reviewTitleLabel(report)})`, reviewBodyHtml(report)));
}

function unavailableReviewHtml(report: ReviewReport): string {
  return htmlShell(
    'PR Review — unavailable',
    `<h1>PR Review</h1><p class="muted">${escapeHtml(report.reason ?? 'Review unavailable.')}</p>`,
  );
}

function reviewBodyHtml(report: ReviewReport): string {
  const verdictLabel = reviewVerdictLabel(report);
  return `
<h1>PR Review</h1>
<div class="card">
<p class="muted">base <code>${escapeHtml(report.base.ref)}</code> (${report.base.resolvedSha?.slice(0, 7) ?? '?'}) → head <code>${escapeHtml(report.head.ref)}</code> (${report.head.resolvedSha?.slice(0, 7) ?? '?'})</p>
<p class="verdict-${report.verdict}" style="font-size: 1.4rem; margin: 0.5rem 0;">${verdictLabel}</p>
<ul>${report.summary.map((s) => `<li>${escapeHtml(s)}</li>`).join('\n')}</ul>
</div>
<h2>Changed files</h2>
${changedFilesHtml(report)}
${cyclesHtml(report)}
${riskyFunctionsHtml(report)}
${dependencyChangesHtml(report)}
`;
}

function reviewTitleLabel(report: ReviewReport): string {
  return reviewVerdictLabel(report).replace(/[^A-Za-z]/g, '').trim();
}

function reviewVerdictLabel(report: ReviewReport): string {
  if (report.verdict === 'block') return '🚫 BLOCK';
  if (report.verdict === 'review') return '👀 REVIEW';
  return '✅ OK';
}

function changedFilesHtml(report: ReviewReport): string {
  if (report.changedFiles.length === 0) return '<p class="muted">No structural changes.</p>';
  return `<table>
<thead><tr><th>File</th><th>Status</th><th class="right">Risk</th><th class="right">CC</th><th class="right">ΔCC</th></tr></thead>
<tbody>${report.changedFiles
    .slice(0, 100)
    .map(
      (f) =>
        `<tr>
<td><code>${escapeHtml(f.relativePath)}</code></td>
<td class="muted">${f.status}</td>
<td class="right">${f.riskScore !== null ? f.riskScore.toFixed(1) : '-'}</td>
<td class="right">${f.cyclomaticComplexity ?? '-'}</td>
<td class="right">${f.cyclomaticDelta === null ? '-' : signed(f.cyclomaticDelta)}</td>
</tr>`,
    )
    .join('\n')}</tbody>
</table>`;
}

function cyclesHtml(report: ReviewReport): string {
  if (report.newCycles.length === 0) return '';
  return `<h2>New / expanded cycles</h2>
<ul>${report.newCycles
    .map(
      (c) =>
        `<li><span class="tag tag-${c.classification}">${c.classification}</span> (${c.size} files): ${c.files.map((f) => `<code>${escapeHtml(f)}</code>`).join(' → ')}</li>`,
    )
    .join('\n')}</ul>`;
}

function riskyFunctionsHtml(report: ReviewReport): string {
  if (report.riskyFunctions.length === 0) return '';
  return `<h2>Risky functions</h2>
<table>
<thead><tr><th>Function</th><th>File</th><th class="right">CC</th><th>Reason</th><th>Δ</th></tr></thead>
<tbody>${report.riskyFunctions
    .slice(0, 50)
    .map(
      (fn) =>
        `<tr>
<td><code>${escapeHtml(fn.name)}</code></td>
<td><code>${escapeHtml(fn.file)}</code>:L${fn.line}</td>
<td class="right">${fn.cyclomaticComplexity}</td>
<td class="muted">${fn.reason}</td>
<td>${fn.baseCc === null ? 'new' : `${fn.baseCc} → ${fn.cyclomaticComplexity}`}</td>
</tr>`,
    )
    .join('\n')}</tbody>
</table>`;
}

function dependencyChangesHtml(report: ReviewReport): string {
  if (report.dependencyChanges.length === 0) return '';
  return `<h2>Dependency changes</h2>${report.dependencyChanges
    .map(
      (d) => `
<h3>${escapeHtml(d.manifestFile)}${d.workspace ? ` <span class="muted">(${escapeHtml(d.workspace)})</span>` : ''}</h3>
<ul>
${d.added.map((a) => `<li>➕ <code>${escapeHtml(a.name)}@${escapeHtml(a.version)}</code> <span class="muted">(${a.kind})</span></li>`).join('\n')}
${d.removed.map((r) => `<li>➖ <code>${escapeHtml(r.name)}@${escapeHtml(r.version)}</code> <span class="muted">(${r.kind})</span></li>`).join('\n')}
${d.bumped.map((b) => `<li>🔄 <code>${escapeHtml(b.name)}</code>: ${escapeHtml(b.from)} → ${escapeHtml(b.to)} <span class="muted">(${b.kind})</span></li>`).join('\n')}
</ul>`,
    )
    .join('\n')}`;
}
