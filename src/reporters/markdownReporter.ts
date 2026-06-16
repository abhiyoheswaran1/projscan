import type { ArchitectureLayer, DirectoryNode } from '../types.js';
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
export { reportHealthMarkdown, reportCiMarkdown } from './markdownHealthReporter.js';

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
