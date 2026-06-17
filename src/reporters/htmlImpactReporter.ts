import type { ImpactReport } from '../types.js';
import { escapeHtml, htmlShell } from './htmlShared.js';

export function reportImpactHtml(report: ImpactReport): void {
  if (!report.available) {
    console.log(unavailableImpactHtml(report));
    return;
  }

  console.log(htmlShell(`Impact: ${report.target.value}`, impactBodyHtml(report)));
}

function unavailableImpactHtml(report: ImpactReport): string {
  return htmlShell(
    'Impact — unavailable',
    `<h1>Impact</h1><p class="muted">${escapeHtml(report.reason ?? 'Impact unavailable.')}</p>`,
  );
}

function impactBodyHtml(report: ImpactReport): string {
  return `
<h1>Impact: ${escapeHtml(report.target.kind)} <code>${escapeHtml(report.target.value)}</code></h1>
<p class="muted">${report.totalReachable} file(s) reachable within distance ${report.maxDistance}${report.truncated ? ' (truncated; more files exist beyond)' : ''}.</p>
${definitionFilesHtml(report)}
<h2>Reachable</h2>
${reachableFilesHtml(report)}
`;
}

function definitionFilesHtml(report: ImpactReport): string {
  return report.definitionFiles.length === 0
    ? ''
    : `<h2>Defined in</h2><ul>${report.definitionFiles.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('\n')}</ul>`;
}

function reachableFilesHtml(report: ImpactReport): string {
  if (report.reachable.length === 0) {
    return '<p class="muted">No reachable files.</p>';
  }

  return `<table>
<thead><tr><th class="right">Distance</th><th>File</th></tr></thead>
<tbody>${reachableRowsHtml(report)}</tbody>
</table>`;
}

function reachableRowsHtml(report: ImpactReport): string {
  return report.reachable
    .slice(0, 200)
    .map((n) => `<tr><td class="right">${n.distance}</td><td><code>${escapeHtml(n.file)}</code></td></tr>`)
    .join('\n');
}
