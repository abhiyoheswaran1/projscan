import type { AnalysisReport } from '../types.js';

export function reportAnalysisMarkdown(report: AnalysisReport): void {
  const lines: string[] = [];

  lines.push('# ProjScan Project Report');
  lines.push('');
  lines.push('## Project');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Language | ${report.languages.primary} |`);

  const frameworks = report.frameworks.frameworks.map((f) => f.name).join(', ');
  if (frameworks) lines.push(`| Frameworks | ${frameworks} |`);

  if (report.dependencies) {
    lines.push(
      `| Dependencies | ${report.dependencies.totalDependencies} prod, ${report.dependencies.totalDevDependencies} dev |`,
    );
  }
  lines.push(`| Files | ${report.scan.totalFiles} |`);
  lines.push(`| Scan Time | ${report.scan.scanDurationMs.toFixed(0)}ms |`);

  const langs = Object.values(report.languages.languages).sort((a, b) => b.fileCount - a.fileCount);
  if (langs.length > 0) {
    lines.push('');
    lines.push('## Languages');
    lines.push('');
    lines.push('| Language | Files | % |');
    lines.push('| --- | --- | --- |');
    for (const lang of langs.slice(0, 10)) {
      lines.push(`| ${lang.name} | ${lang.fileCount} | ${lang.percentage.toFixed(1)}% |`);
    }
  }

  if (report.issues.length > 0) {
    lines.push('');
    lines.push('## Issues');
    lines.push('');
    for (const issue of report.issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`- ${icon} **${issue.title}**: ${issue.description}`);
    }
  }

  console.log(lines.join('\n'));
}
