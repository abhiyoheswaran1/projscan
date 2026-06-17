import type {
  CouplingReport,
  HotspotReport,
  Issue,
} from '../types.js';
import type { ReportControlsMetadata } from '../core/reportScope.js';
import { calculateScore, badgeMarkdown } from '../utils/scoreCalculator.js';
import { escapeHtml, htmlShell, reportControlsHtml, severityIcon } from './htmlShared.js';

export { htmlShell } from './htmlShared.js';
export { reportAnalysisHtml } from './htmlAnalysisReporter.js';
export { reportCoverageHtml } from './htmlCoverageReporter.js';
export { reportImpactHtml } from './htmlImpactReporter.js';
export { reportPrDiffHtml } from './htmlPrDiffReporter.js';
export { reportReviewHtml } from './htmlReviewReporter.js';

/**
 * Standalone HTML report (0.16.0+). Each top-level command has its own
 * renderer; the output is a single self-contained HTML document with
 * inline CSS, no external assets, no JS framework. Suitable for posting
 * as a CI artifact or sharing in a PR comment.
 *
 * Style choices:
 *   - System font stack to render readably without webfonts.
 *   - Two-tone colour palette (neutral grey + one accent per severity).
 *   - Tables for data, no charts. Charts would need JS.
 *   - Accessibility: tables get `<th>`s with scope, severity has both
 *     colour AND a text glyph so colourblind readers don't lose info.
 */

export function reportHealthHtml(issues: Issue[], reportControls?: ReportControlsMetadata): void {
  const { score, grade, errors, warnings, infos } = calculateScore(issues);
  const sevTotals = `<span class="severity-error">${errors}</span> errors · <span class="severity-warning">${warnings}</span> warnings · <span class="severity-info">${infos}</span> info`;
  const issuesHtml =
    issues.length === 0
      ? '<p>No issues detected. Project looks healthy.</p>'
      : `<table>
<thead><tr><th>Severity</th><th>Title</th><th>Description</th><th>Suggested action</th></tr></thead>
<tbody>${issues
          .map(
            (i) =>
              `<tr>
<td class="severity-${i.severity}">${severityIcon(i.severity)} ${i.severity}</td>
<td><code>${escapeHtml(i.id)}</code><br>${escapeHtml(i.title)}</td>
<td class="muted">${escapeHtml(i.description)}</td>
<td>${i.suggestedAction ? `${escapeHtml(i.suggestedAction.summary)}<br><code>projscan fix-suggest ${escapeHtml(i.id)}</code>` : '<span class="muted">—</span>'}</td>
</tr>`,
          )
          .join('\n')}</tbody>
</table>`;

  const body = `
<h1>Project health</h1>
${reportControlsHtml(reportControls)}
<div class="card">
<div class="score grade-${grade.replace('+', '\\+')}">${grade}</div>
<div>${score} / 100 — ${sevTotals}</div>
<p class="muted" style="margin-bottom: 0;">${badgeMarkdown(grade)}</p>
</div>
<h2>Issues (${issues.length})</h2>
${issuesHtml}
`;
  console.log(htmlShell(`Health · ${grade} (${score}/100)`, body));
}

export function reportHotspotsHtml(report: HotspotReport): void {
  if (!report.available) {
    console.log(
      htmlShell(
        'Hotspots — unavailable',
        `<h1>Hotspots</h1><p class="muted">${escapeHtml(report.reason ?? 'Hotspots unavailable.')}</p>`,
      ),
    );
    return;
  }
  const rows = report.hotspots
    .map(
      (h, i) =>
        `<tr>
<td class="right">${i + 1}</td>
<td class="right">${h.riskScore.toFixed(1)}</td>
<td><code>${escapeHtml(h.relativePath)}</code></td>
<td class="right">${h.churn}</td>
<td class="right">${typeof h.cyclomaticComplexity === 'number' ? h.cyclomaticComplexity : '-'}</td>
<td class="right">${h.lineCount}</td>
<td class="right">${h.issueCount}</td>
<td class="muted">${escapeHtml(h.reasons.join(', '))}</td>
</tr>`,
    )
    .join('\n');
  const body = `
<h1>Hotspots</h1>
<p class="muted">Window: <strong>${escapeHtml(String(report.window.since ?? 'all'))}</strong> · ${report.window.commitsScanned} commit(s) scanned · ${report.totalFilesRanked} file(s) ranked</p>
<table>
<thead><tr><th>#</th><th class="right">Score</th><th>File</th><th class="right">Churn</th><th class="right">CC</th><th class="right">Lines</th><th class="right">Issues</th><th>Reasons</th></tr></thead>
<tbody>${rows}</tbody>
</table>
`;
  console.log(htmlShell('Hotspots', body));
}

export function reportCouplingHtml(report: CouplingReport): void {
  const cyclesHtml =
    report.cycles.length === 0
      ? '<p class="muted">No circular imports detected.</p>'
      : `<table>
<thead><tr><th class="right">Size</th><th>Files</th></tr></thead>
<tbody>${report.cycles
          .map(
            (c) =>
              `<tr><td class="right">${c.size}</td><td>${c.files.map((f) => `<code>${escapeHtml(f)}</code>`).join(' → ')}</td></tr>`,
          )
          .join('\n')}</tbody>
</table>`;

  const filesRows = report.files
    .slice(0, 100)
    .map(
      (f) =>
        `<tr><td><code>${escapeHtml(f.relativePath)}</code></td><td class="right">${f.fanIn}</td><td class="right">${f.fanOut}</td><td class="right">${f.instability.toFixed(3)}</td></tr>`,
    )
    .join('\n');

  const body = `
<h1>Coupling</h1>
<h2>Cycles (${report.cycles.length})</h2>
${cyclesHtml}
<h2>Files (top 100 by fan-in)</h2>
<table>
<thead><tr><th>File</th><th class="right">Fan-in</th><th class="right">Fan-out</th><th class="right">Instability</th></tr></thead>
<tbody>${filesRows}</tbody>
</table>
`;
  console.log(htmlShell('Coupling', body));
}
