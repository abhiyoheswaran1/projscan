import type {
  CoverageJoinedReport,
  CouplingReport,
  Issue,
  FileExplanation,
  ArchitectureLayer,
  DirectoryNode,
  HotspotReport,
  OutdatedReport,
  PrDiffReport,
  WorkspaceInfo,
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

export function reportExplanationMarkdown(explanation: FileExplanation): void {
  const lines: string[] = [`# File: ${explanation.filePath}`, ''];

  lines.push(`**Purpose:** ${explanation.purpose}`);
  lines.push(`**Lines:** ${explanation.lineCount}`);

  if (explanation.imports.length > 0) {
    lines.push('');
    lines.push('## Dependencies');
    for (const imp of explanation.imports) {
      lines.push(`- \`${imp.source}\`${imp.isRelative ? ' (local)' : ''}`);
    }
  }

  if (explanation.exports.length > 0) {
    lines.push('');
    lines.push('## Exports');
    for (const exp of explanation.exports) {
      lines.push(`- \`${exp.name}\` (${exp.type})`);
    }
  }

  if (explanation.potentialIssues.length > 0) {
    lines.push('');
    lines.push('## Potential Issues');
    for (const issue of explanation.potentialIssues) {
      lines.push(`- ⚠️ ${issue}`);
    }
  }

  console.log(lines.join('\n'));
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

export function reportHotspotsMarkdown(report: HotspotReport): void {
  const lines: string[] = ['# Project Hotspots', ''];

  if (!report.available) {
    lines.push(`> ${report.reason ?? 'Hotspot analysis unavailable.'}`);
    console.log(lines.join('\n'));
    return;
  }

  const { since, commitsScanned } = report.window;
  lines.push(
    `_Scanned **${commitsScanned}** commit(s) since **${since}** · ranked **${report.totalFilesRanked}** file(s)_`,
  );
  lines.push('');

  if (report.hotspots.length === 0) {
    lines.push('No hotspots detected.');
    console.log(lines.join('\n'));
    return;
  }

  lines.push('| # | Score | File | Churn | CC | Lines | Issues | Reasons |');
  lines.push('| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |');
  for (let i = 0; i < report.hotspots.length; i++) {
    const h = report.hotspots[i];
    const reasons = h.reasons.length > 0 ? h.reasons.join(', ') : '-';
    const cc = typeof h.cyclomaticComplexity === 'number' ? String(h.cyclomaticComplexity) : '-';
    lines.push(
      `| ${i + 1} | ${h.riskScore.toFixed(1)} | \`${h.relativePath}\` | ${h.churn} | ${cc} | ${h.lineCount} | ${h.issueCount} | ${reasons} |`,
    );
  }

  console.log(lines.join('\n'));
}

export function reportCouplingMarkdown(report: CouplingReport): void {
  const lines: string[] = ['# Coupling + Cycles', ''];
  const xpkg = report.totalCrossPackageEdges;
  lines.push(
    `_${report.totalFiles} file(s) in graph · ${report.totalCycles} cycle(s)${xpkg > 0 ? ` · ${xpkg} cross-package edge(s)` : ''}_`,
    '',
  );

  if (report.cycles.length > 0) {
    lines.push('## Import cycles', '');
    for (const c of report.cycles) {
      lines.push(`- **${c.size}-file cycle:** ${c.files.map((f) => `\`${f}\``).join(' → ')} → …`);
    }
    lines.push('');
  }

  if (report.crossPackageEdges.length > 0) {
    lines.push('## Cross-package edges', '');
    lines.push('| From package | From file | To package | To file |');
    lines.push('| --- | --- | --- | --- |');
    for (const e of report.crossPackageEdges) {
      lines.push(
        `| \`${e.from.package}\` | \`${e.from.file}\` | \`${e.to.package}\` | \`${e.to.file}\` |`,
      );
    }
    lines.push('');
  }

  if (report.files.length > 0) {
    lines.push('## Files', '');
    lines.push('| File | Fan-in | Fan-out | Instability |');
    lines.push('| --- | ---: | ---: | ---: |');
    for (const f of report.files) {
      lines.push(
        `| \`${f.relativePath}\` | ${f.fanIn} | ${f.fanOut} | ${f.instability.toFixed(2)} |`,
      );
    }
  }

  console.log(lines.join('\n'));
}

export function reportPrDiffMarkdown(report: PrDiffReport): void {
  const lines: string[] = ['# PR Structural Diff', ''];
  if (!report.available) {
    lines.push(`> ${report.reason ?? 'PR diff unavailable.'}`);
    console.log(lines.join('\n'));
    return;
  }
  appendPrDiffHeader(lines, report);
  appendPrDiffAdded(lines, report);
  appendPrDiffRemoved(lines, report);
  appendPrDiffModified(lines, report);
  console.log(lines.join('\n'));
}

function appendPrDiffHeader(lines: string[], report: PrDiffReport): void {
  lines.push(
    `_base **${report.base.ref}** (${report.base.resolvedSha?.slice(0, 7) ?? '?'}) → head **${report.head.ref}** (${report.head.resolvedSha?.slice(0, 7) ?? '?'})_`,
    '',
    `**${report.totalFilesChanged}** file(s) changed: +${report.filesAdded.length} added, -${report.filesRemoved.length} removed, ~${report.filesModified.length} modified`,
    '',
  );
}

function appendPrDiffAdded(lines: string[], report: PrDiffReport): void {
  if (report.filesAdded.length === 0) return;
  lines.push('## Added', '');
  for (const f of report.filesAdded) lines.push(`- \`${f}\``);
  lines.push('');
}

function appendPrDiffRemoved(lines: string[], report: PrDiffReport): void {
  if (report.filesRemoved.length === 0) return;
  lines.push('## Removed', '');
  for (const f of report.filesRemoved) lines.push(`- \`${f}\``);
  lines.push('');
}

function appendPrDiffModified(lines: string[], report: PrDiffReport): void {
  if (report.filesModified.length === 0) return;
  lines.push('## Modified', '');
  for (const m of report.filesModified) appendPrDiffModifiedEntry(lines, m);
}

function appendPrDiffModifiedEntry(
  lines: string[],
  m: PrDiffReport['filesModified'][number],
): void {
  const ccDelta = m.cyclomaticDelta;
  const fiDelta = m.fanInDelta;
  const dCC = ccDelta === null ? '' : ` · ΔCC ${signed(ccDelta)}`;
  const dFI = fiDelta === null || fiDelta === 0 ? '' : ` · Δfan-in ${signed(fiDelta)}`;
  lines.push(`### \`${m.relativePath}\`${dCC}${dFI}`, '');
  if (m.exportsAdded.length > 0)
    lines.push(`- **+exports:** ${m.exportsAdded.map((s) => `\`${s}\``).join(', ')}`);
  if (m.exportsRemoved.length > 0)
    lines.push(`- **-exports:** ${m.exportsRemoved.map((s) => `\`${s}\``).join(', ')}`);
  if (m.exportsRenamed.length > 0) {
    const pairs = m.exportsRenamed.map((r) => `\`${r.from}\` → \`${r.to}\``).join(', ');
    lines.push(`- **~exports:** ${pairs}`);
  }
  if (m.importsAdded.length > 0)
    lines.push(`- **+imports:** ${m.importsAdded.map((s) => `\`${s}\``).join(', ')}`);
  if (m.importsRemoved.length > 0)
    lines.push(`- **-imports:** ${m.importsRemoved.map((s) => `\`${s}\``).join(', ')}`);
  lines.push('');
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

export function reportWorkspacesMarkdown(info: WorkspaceInfo): void {
  const lines: string[] = ['# Workspaces', ''];
  lines.push(
    `_kind: **${info.kind}**${info.source ? ` · source: ${info.source}` : ''} · ${info.packages.length} package(s)_`,
    '',
  );
  if (info.packages.length === 0) {
    lines.push('No packages detected.');
    console.log(lines.join('\n'));
    return;
  }
  lines.push('| Package | Path | Version | Root |');
  lines.push('| --- | --- | --- | :-: |');
  for (const p of info.packages) {
    lines.push(
      `| \`${p.name}\` | \`${p.relativePath || '.'}\` | ${p.version ?? '-'} | ${p.isRoot ? '✓' : ''} |`,
    );
  }
  console.log(lines.join('\n'));
}

export function reportOutdatedMarkdown(report: OutdatedReport): void {
  const lines: string[] = [];
  lines.push('# Outdated Packages');
  lines.push('');
  if (!report.available) {
    lines.push(`_${report.reason ?? 'unavailable'}_`);
    console.log(lines.join('\n'));
    return;
  }

  const drifting = report.packages.filter((p) => p.drift !== 'same' && p.drift !== 'unknown');
  lines.push(`**${report.totalPackages}** declared · **${drifting.length}** drifted`);
  lines.push('');

  if (drifting.length === 0) {
    lines.push('_All declared packages match installed versions._');
    console.log(lines.join('\n'));
    return;
  }

  lines.push('| Package | Scope | Declared | Installed | Drift |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const p of drifting) {
    lines.push(
      `| \`${p.name}\` | ${p.scope === 'devDependency' ? 'dev' : 'prod'} | ${p.declared} | ${p.installed ?? '-'} | ${p.drift} |`,
    );
  }

  console.log(lines.join('\n'));
}

export function reportCoverageMarkdown(report: CoverageJoinedReport): void {
  const lines: string[] = [];
  lines.push('# Coverage × Hotspots');
  lines.push('');
  if (!report.available) {
    lines.push(`_${report.reason ?? 'unavailable'}_`);
    console.log(lines.join('\n'));
    return;
  }

  if (report.coverageSourceFile) {
    lines.push(`_Source: \`${report.coverageSourceFile}\` (${report.coverageSource})_`);
    lines.push('');
  }

  if (report.entries.length === 0) {
    lines.push('_No hotspots intersected with coverage data._');
    console.log(lines.join('\n'));
    return;
  }

  lines.push('| Priority | Coverage | Risk | Churn | File | Reasons |');
  lines.push('| ---: | ---: | ---: | ---: | --- | --- |');
  for (const e of report.entries) {
    const cov = e.coverage === null ? '-' : `${e.coverage.toFixed(0)}%`;
    const reasons = e.reasons.length > 0 ? e.reasons.join(', ') : '-';
    lines.push(
      `| ${e.priority.toFixed(1)} | ${cov} | ${e.riskScore.toFixed(1)} | ${e.churn} | \`${e.relativePath}\` | ${reasons} |`,
    );
  }

  console.log(lines.join('\n'));
}
