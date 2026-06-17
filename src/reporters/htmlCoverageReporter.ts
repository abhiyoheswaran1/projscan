import type { CoverageJoinedReport } from '../types.js';
import { escapeHtml, htmlShell } from './htmlShared.js';

export function reportCoverageHtml(report: CoverageJoinedReport): void {
  if (!report.available) {
    console.log(unavailableCoverageHtml(report));
    return;
  }

  console.log(htmlShell('Coverage × Risk', coverageBodyHtml(report)));
}

function unavailableCoverageHtml(report: CoverageJoinedReport): string {
  return htmlShell(
    'Coverage — unavailable',
    `<h1>Coverage × Risk</h1><p class="muted">${escapeHtml(report.reason ?? 'Coverage unavailable.')}</p>`,
  );
}

function coverageBodyHtml(report: CoverageJoinedReport): string {
  const sourceLabel = report.coverageSource ?? 'no coverage source';
  const sourceFile = report.coverageSourceFile
    ? ` (<code>${escapeHtml(report.coverageSourceFile)}</code>)`
    : '';
  return `
<h1>Coverage × Risk</h1>
<p class="muted">Source: ${escapeHtml(sourceLabel)}${sourceFile} · ${report.entries.length} file(s) ranked.</p>
<p>Rows highlighted in red have <strong>coverage &lt; 50%</strong> AND <strong>risk score &gt; 50</strong> — the "scariest untested files" combination. The Priority column blends risk and uncovered fraction; rows are sorted by it.</p>
<table>
<thead><tr><th>#</th><th>File</th><th class="right">Risk</th><th class="right">Coverage</th><th class="right">Priority</th><th class="right">Lines</th><th>Reasons</th></tr></thead>
<tbody>${coverageRowsHtml(report)}</tbody>
</table>
${report.entries.length > 100 ? `<p class="muted">… and ${report.entries.length - 100} more</p>` : ''}
`;
}

function coverageRowsHtml(report: CoverageJoinedReport): string {
  return report.entries
    .slice(0, 100)
    .map((h, i) => {
      const covPct = coverageLabel(h.coverage);
      const cls = riskyCoverageRowClass(h.coverage, h.riskScore);
      return `<tr${cls}>
<td class="right">${i + 1}</td>
<td><code>${escapeHtml(h.relativePath)}</code></td>
<td class="right">${h.riskScore.toFixed(1)}</td>
<td class="right">${covPct}</td>
<td class="right">${h.priority.toFixed(1)}</td>
<td class="right">${h.lineCount}</td>
<td class="muted">${escapeHtml(h.reasons.join(', '))}</td>
</tr>`;
    })
    .join('\n');
}

function coverageLabel(coverage: number | null): string {
  return coverage === null ? '-' : `${Math.round(coverage * 100)}%`;
}

function riskyCoverageRowClass(coverage: number | null, riskScore: number): string {
  return coverage !== null && coverage < 0.5 && riskScore > 50 ? ' class="severity-error"' : '';
}
