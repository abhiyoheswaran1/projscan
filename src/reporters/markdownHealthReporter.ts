import type { Issue } from '../types.js';
import type { ReportControlsMetadata } from '../core/reportScope.js';
import type { CiFailOnSeverity } from '../types/config.js';
import { evaluateCiGate } from '../core/ciGate.js';
import { calculateScore, badgeMarkdown } from '../utils/scoreCalculator.js';

export function reportHealthMarkdown(
  issues: Issue[],
  reportControls?: ReportControlsMetadata,
): void {
  const { score, grade } = calculateScore(issues);
  const lines: string[] = ['# Project Health Report', ''];

  appendReportControlsMarkdown(lines, reportControls);
  lines.push(`**Health Score: ${grade} (${score}/100)**`);
  lines.push('');
  lines.push(badgeMarkdown(grade));
  lines.push('');
  appendHealthIssues(lines, issues);

  console.log(lines.join('\n'));
}

export function reportCiMarkdown(
  issues: Issue[],
  threshold: number,
  reportControls?: ReportControlsMetadata,
  failOn?: CiFailOnSeverity,
): void {
  const gate = evaluateCiGate(issues, threshold, failOn);
  const lines: string[] = [`# Projscan CI - ${ciLabel(gate.pass)}`, ''];
  appendReportControlsMarkdown(lines, reportControls);
  lines.push(
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Score | **${gate.score}/100** |`,
    `| Grade | **${gate.grade}** |`,
    `| Threshold | ${threshold} |`,
    `| Fail on | ${gate.failOn} |`,
    `| Result | ${ciIcon(gate.pass)} ${ciResultLabel(gate.pass)} |`,
  );
  appendCiIssues(lines, issues);

  console.log(lines.join('\n'));
}

function appendReportControlsMarkdown(
  lines: string[],
  reportControls: ReportControlsMetadata | undefined,
): void {
  if (!reportControls) return;
  lines.push(
    `> Report controls: active; scopes: ${reportControls.scopeCount}; path redaction: ${reportControls.redactPaths ? (reportControls.pathLabelFormat ?? 'enabled') : 'disabled'}.`,
  );
  lines.push('');
}

function appendHealthIssues(lines: string[], issues: Issue[]): void {
  if (issues.length === 0) {
    lines.push('No issues detected. Project looks healthy!');
    return;
  }

  lines.push(`Found **${issues.length}** issue(s).`);
  lines.push('');
  for (const issue of issues) {
    lines.push(`- ${severityIcon(issue)} **${issue.title}** - ${issue.description}`);
    if (issue.suggestedAction) {
      lines.push(
        `  - **Action:** ${issue.suggestedAction.summary} _(\`projscan fix-suggest ${issue.id}\`)_`,
      );
    }
  }
}

function appendCiIssues(lines: string[], issues: Issue[]): void {
  if (issues.length === 0) return;
  lines.push('', '## Issues', '');
  for (const issue of issues) {
    lines.push(`- ${severityIcon(issue)} **${issue.title}** - ${issue.description}`);
  }
}

function severityIcon(issue: Issue): string {
  if (issue.severity === 'error') return '❌';
  if (issue.severity === 'warning') return '⚠️';
  return 'ℹ️';
}

function ciLabel(pass: boolean): 'PASS' | 'FAIL' {
  return pass ? 'PASS' : 'FAIL';
}

function ciResultLabel(pass: boolean): 'Pass' | 'Fail' {
  return pass ? 'Pass' : 'Fail';
}

function ciIcon(pass: boolean): '✅' | '❌' {
  return pass ? '✅' : '❌';
}
