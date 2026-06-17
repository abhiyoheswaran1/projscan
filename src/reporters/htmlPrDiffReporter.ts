import type { PrDiffReport } from '../types.js';
import { escapeHtml, htmlShell, signed } from './htmlShared.js';

type ModifiedFile = PrDiffReport['filesModified'][number];

export function reportPrDiffHtml(report: PrDiffReport): void {
  if (!report.available) {
    console.log(unavailablePrDiffHtml(report));
    return;
  }
  console.log(htmlShell('PR Structural Diff', prDiffBodyHtml(report)));
}

function unavailablePrDiffHtml(report: PrDiffReport): string {
  return htmlShell(
    'PR Diff — unavailable',
    `<h1>PR Structural Diff</h1><p class="muted">${escapeHtml(report.reason ?? 'PR diff unavailable.')}</p>`,
  );
}

function prDiffBodyHtml(report: PrDiffReport): string {
  return `
<h1>PR Structural Diff</h1>
<p class="muted">base <code>${escapeHtml(report.base.ref)}</code> (${report.base.resolvedSha?.slice(0, 7) ?? '?'}) → head <code>${escapeHtml(report.head.ref)}</code> (${report.head.resolvedSha?.slice(0, 7) ?? '?'})</p>
<p><strong>${report.totalFilesChanged}</strong> file(s) changed: <span class="severity-info">+${report.filesAdded.length}</span> added, <span class="severity-error">−${report.filesRemoved.length}</span> removed, <span class="severity-warning">~${report.filesModified.length}</span> modified.</p>
${addedFilesHtml(report)}
${removedFilesHtml(report)}
${modifiedFilesHtml(report)}
`;
}

function addedFilesHtml(report: PrDiffReport): string {
  if (report.filesAdded.length === 0) return '';
  return `<h2>Added (${report.filesAdded.length})</h2>
<ul>${report.filesAdded.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('\n')}</ul>`;
}

function removedFilesHtml(report: PrDiffReport): string {
  if (report.filesRemoved.length === 0) return '';
  return `<h2>Removed (${report.filesRemoved.length})</h2>
<ul>${report.filesRemoved.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('\n')}</ul>`;
}

function modifiedFilesHtml(report: PrDiffReport): string {
  if (report.filesModified.length === 0) return '';
  return `<h2>Modified (${report.filesModified.length})</h2>
${report.filesModified.slice(0, 100).map(modifiedFileHtml).join('\n')}
${modifiedOverflowHtml(report)}`;
}

function modifiedFileHtml(file: ModifiedFile): string {
  return `<h3><code>${escapeHtml(file.relativePath)}</code><span class="muted">${modifiedDeltas(file)}</span></h3>
${modifiedStructuralLinesHtml(file)}`;
}

function modifiedDeltas(file: ModifiedFile): string {
  const dCC = file.cyclomaticDelta === null ? '' : ` · ΔCC ${signed(file.cyclomaticDelta)}`;
  const dFI =
    file.fanInDelta === null || file.fanInDelta === 0
      ? ''
      : ` · Δfan-in ${signed(file.fanInDelta)}`;
  return `${dCC}${dFI}`;
}

function modifiedStructuralLinesHtml(file: ModifiedFile): string {
  const lines = [
    ...symbolListLine('+exports', 'severity-info', file.exportsAdded),
    ...symbolListLine('−exports', 'severity-error', file.exportsRemoved),
    ...renamedExportLine(file.exportsRenamed),
    ...symbolListLine('+imports', 'severity-info', file.importsAdded),
    ...symbolListLine('−imports', 'severity-error', file.importsRemoved),
  ];
  return lines.length === 0
    ? '<p class="muted">No structural change beyond CC / fan-in.</p>'
    : `<ul>${lines.join('\n')}</ul>`;
}

function symbolListLine(label: string, severityClass: string, symbols: string[]): string[] {
  if (symbols.length === 0) return [];
  return [
    `<li><strong class="${severityClass}">${label}:</strong> ${symbols.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ')}</li>`,
  ];
}

function renamedExportLine(exportsRenamed: ModifiedFile['exportsRenamed']): string[] {
  if (exportsRenamed.length === 0) return [];
  const pairs = exportsRenamed
    .map((r) => `<code>${escapeHtml(r.from)}</code> → <code>${escapeHtml(r.to)}</code>`)
    .join(', ');
  return [`<li><strong class="severity-warning">~exports:</strong> ${pairs}</li>`];
}

function modifiedOverflowHtml(report: PrDiffReport): string {
  return report.filesModified.length > 100
    ? `<p class="muted">… and ${report.filesModified.length - 100} more</p>`
    : '';
}
