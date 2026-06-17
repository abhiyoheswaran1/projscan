import type { AnalysisReport } from '../types.js';
import type { ReportControlsMetadata } from '../core/reportScope.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import { escapeHtml, htmlShell, reportControlsHtml, severityIcon } from './htmlShared.js';

export function reportAnalysisHtml(
  report: AnalysisReport,
  reportControls?: ReportControlsMetadata,
): void {
  console.log(htmlShell(`Analysis · ${report.projectName}`, analysisBodyHtml(report, reportControls)));
}

function analysisBodyHtml(
  report: AnalysisReport,
  reportControls: ReportControlsMetadata | undefined,
): string {
  const { score, grade, errors, warnings, infos } = calculateScore(report.issues);
  return `
<h1>Project analysis: ${escapeHtml(report.projectName)}</h1>
${reportControlsHtml(reportControls)}
<div class="card">
<div class="score grade-${grade.replace('+', '\\+')}">${grade}</div>
<div>${score} / 100 · <span class="severity-error">${errors}</span> errors · <span class="severity-warning">${warnings}</span> warnings · <span class="severity-info">${infos}</span> info</div>
<p class="muted" style="margin-bottom: 0;">${escapeHtml(report.scan.totalFiles.toString())} file(s) · ${escapeHtml(report.scan.totalDirectories.toString())} directories · ${Math.round(report.scan.scanDurationMs)}ms scan</p>
</div>
${projectMetadataHtml(report)}
${languagesTableHtml(report)}
${issuesTableHtml(report)}
${filesTableHtml(report)}
`;
}

function projectMetadataHtml(report: AnalysisReport): string {
  const frameworkNames = report.frameworks.frameworks.map((f) => f.name);
  const buildTools = report.frameworks.buildTools;
  return `<div class="card">
<p><strong>Primary language:</strong> ${escapeHtml(report.languages.primary)}</p>
<p><strong>Frameworks:</strong> ${frameworkNames.length > 0 ? frameworkNames.map(escapeHtml).join(', ') : '<span class="muted">none detected</span>'}</p>
<p><strong>Build tools:</strong> ${buildTools.length > 0 ? buildTools.map(escapeHtml).join(', ') : '<span class="muted">none detected</span>'}</p>
<p><strong>Package manager:</strong> ${escapeHtml(report.frameworks.packageManager)}</p>
<p><strong>Dependencies:</strong> ${escapeHtml(dependencySummary(report))}</p>
</div>`;
}

function dependencySummary(report: AnalysisReport): string {
  return report.dependencies
    ? `${report.dependencies.totalDependencies} production · ${report.dependencies.totalDevDependencies} development`
    : 'No package manifest detected';
}

function languagesTableHtml(report: AnalysisReport): string {
  return `<h2>Languages</h2>
<table>
<thead><tr><th>Language</th><th class="right">Files</th><th class="right">Share</th><th>Extensions</th></tr></thead>
<tbody>${languageRowsHtml(report)}</tbody>
</table>`;
}

function languageRowsHtml(report: AnalysisReport): string {
  const rows = Object.values(report.languages.languages)
    .sort((a, b) => b.fileCount - a.fileCount)
    .map(
      (lang) => `<tr>
<td>${escapeHtml(lang.name)}</td>
<td class="right">${lang.fileCount}</td>
<td class="right">${lang.percentage.toFixed(1)}%</td>
<td class="muted">${lang.extensions.map((ext) => `<code>${escapeHtml(ext)}</code>`).join(' ')}</td>
</tr>`,
    )
    .join('\n');
  return rows || '<tr><td colspan="4" class="muted">No source files detected.</td></tr>';
}

function issuesTableHtml(report: AnalysisReport): string {
  return `<h2>Issues (${report.issues.length})</h2>
<table>
<thead><tr><th>Severity</th><th>Issue</th><th>Description</th><th>Location</th></tr></thead>
<tbody>${issueRowsHtml(report)}</tbody>
</table>
${report.issues.length > 100 ? `<p class="muted">… and ${report.issues.length - 100} more issue(s)</p>` : ''}`;
}

function issueRowsHtml(report: AnalysisReport): string {
  if (report.issues.length === 0) return '<tr><td colspan="4" class="muted">No issues detected.</td></tr>';
  return report.issues
    .slice(0, 100)
    .map(
      (issue) => `<tr>
<td class="severity-${issue.severity}">${severityIcon(issue.severity)} ${issue.severity}</td>
<td><code>${escapeHtml(issue.id)}</code><br>${escapeHtml(issue.title)}</td>
<td class="muted">${escapeHtml(issue.description)}</td>
<td>${issue.locations?.map((loc) => `<code>${escapeHtml(loc.file)}${loc.line ? `:${loc.line}` : ''}</code>`).join('<br>') ?? '<span class="muted">—</span>'}</td>
</tr>`,
    )
    .join('\n');
}

function filesTableHtml(report: AnalysisReport): string {
  return `<h2>Files (${report.scan.totalFiles})</h2>
<table>
<thead><tr><th>File</th><th>Extension</th><th class="right">Bytes</th><th>Directory</th></tr></thead>
<tbody>${fileRowsHtml(report)}</tbody>
</table>
${report.scan.files.length > 100 ? `<p class="muted">… and ${report.scan.files.length - 100} more file(s)</p>` : ''}`;
}

function fileRowsHtml(report: AnalysisReport): string {
  const rows = report.scan.files
    .slice(0, 100)
    .map(
      (file) => `<tr>
<td><code>${escapeHtml(file.relativePath)}</code></td>
<td>${escapeHtml(file.extension || '(none)')}</td>
<td class="right">${file.sizeBytes}</td>
<td class="muted">${escapeHtml(file.directory || '.')}</td>
</tr>`,
    )
    .join('\n');
  return rows || '<tr><td colspan="4" class="muted">No files detected.</td></tr>';
}
