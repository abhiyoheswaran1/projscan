import type {
  Issue,
  ArchitectureLayer,
  DirectoryNode,
} from '../types.js';
import type { ReportControlsMetadata } from '../core/reportScope.js';
import { calculateScore, badgeMarkdown } from '../utils/scoreCalculator.js';
export { reportDiffMarkdown } from './markdownDiffReporter.js';
export { reportFileMarkdown } from './markdownFileReporter.js';
export { reportReviewMarkdown } from './markdownReviewReporter.js';
export { reportDependenciesMarkdown } from './markdownDependencyReporter.js';
export {
  reportExplainIssueMarkdown,
  reportFixSuggestMarkdown,
} from './markdownFixGuidanceReporter.js';
export { reportImpactMarkdown } from './markdownImpactReporter.js';
export { reportUpgradeMarkdown } from './markdownUpgradeReporter.js';
export { reportAuditMarkdown } from './markdownAuditReporter.js';
export { reportAnalysisMarkdown } from './markdownAnalysisReporter.js';
export { reportPrDiffMarkdown } from './markdownPrDiffReporter.js';
export { reportCoverageMarkdown } from './markdownCoverageReporter.js';
export { reportCouplingMarkdown } from './markdownCouplingReporter.js';
export { reportOutdatedMarkdown } from './markdownOutdatedReporter.js';
export { reportHotspotsMarkdown } from './markdownHotspotReporter.js';
export { reportWorkspacesMarkdown } from './markdownWorkspaceReporter.js';
export { reportExplanationMarkdown } from './markdownExplanationReporter.js';

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

  if (issues.length === 0) {
    lines.push('No issues detected. Project looks healthy!');
  } else {
    lines.push(`Found **${issues.length}** issue(s).`);
    lines.push('');
    for (const issue of issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`- ${icon} **${issue.title}** - ${issue.description}`);
      if (issue.suggestedAction) {
        lines.push(
          `  - **Action:** ${issue.suggestedAction.summary} _(\`projscan fix-suggest ${issue.id}\`)_`,
        );
      }
    }
  }

  console.log(lines.join('\n'));
}

export function reportCiMarkdown(
  issues: Issue[],
  threshold: number,
  reportControls?: ReportControlsMetadata,
): void {
  const { score, grade } = calculateScore(issues);
  const pass = score >= threshold;
  const lines: string[] = [`# Projscan CI - ${pass ? 'PASS' : 'FAIL'}`, ''];
  appendReportControlsMarkdown(lines, reportControls);
  lines.push(
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Score | **${score}/100** |`,
    `| Grade | **${grade}** |`,
    `| Threshold | ${threshold} |`,
    `| Result | ${pass ? '✅ Pass' : '❌ Fail'} |`,
  );

  if (issues.length > 0) {
    lines.push('', '## Issues', '');
    for (const issue of issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`- ${icon} **${issue.title}** - ${issue.description}`);
    }
  }

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

export function reportDiagramMarkdown(layers: ArchitectureLayer[]): void {
  const lines: string[] = ['# Project Architecture', '', '```'];

  for (const layer of layers) {
    lines.push(layer.name);
    lines.push(`└─ ${layer.technologies.join(' / ')}`);
    for (const dir of layer.directories) {
      lines.push(`   └─ ${dir}`);
    }
    lines.push('');
  }

  lines.push('```');
  console.log(lines.join('\n'));
}

export function reportStructureMarkdown(tree: DirectoryNode): void {
  const lines: string[] = ['# Project Structure', '', '```'];
  lines.push(`${tree.name}/ (${tree.totalFileCount} files)`);
  buildTreeLines(tree.children, '', lines);
  lines.push('```');
  console.log(lines.join('\n'));
}

function buildTreeLines(nodes: DirectoryNode[], indent: string, lines: string[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childIndent = isLast ? '    ' : '│   ';

    lines.push(`${indent}${connector}${node.name}/ (${node.totalFileCount} files)`);
    if (node.children.length > 0) {
      buildTreeLines(node.children, indent + childIndent, lines);
    }
  }
}
