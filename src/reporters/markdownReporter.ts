import type {
  AnalysisReport,
  Issue,
  FileExplanation,
  FileInspection,
  ArchitectureLayer,
  DirectoryNode,
  DependencyReport,
  DiffResult,
  HotspotReport,
} from '../types.js';
import { calculateScore, badgeMarkdown } from '../utils/scoreCalculator.js';

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
    lines.push(`| Dependencies | ${report.dependencies.totalDependencies} prod, ${report.dependencies.totalDevDependencies} dev |`);
  }
  lines.push(`| Files | ${report.scan.totalFiles} |`);
  lines.push(`| Scan Time | ${report.scan.scanDurationMs.toFixed(0)}ms |`);

  // Languages
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

  // Issues
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

export function reportHealthMarkdown(issues: Issue[]): void {
  const { score, grade } = calculateScore(issues);
  const lines: string[] = ['# Project Health Report', ''];

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
      lines.push(`- ${icon} **${issue.title}** — ${issue.description}`);
    }
  }

  console.log(lines.join('\n'));
}

export function reportCiMarkdown(issues: Issue[], threshold: number): void {
  const { score, grade } = calculateScore(issues);
  const pass = score >= threshold;
  const lines: string[] = [
    `# Projscan CI — ${pass ? 'PASS' : 'FAIL'}`,
    '',
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Score | **${score}/100** |`,
    `| Grade | **${grade}** |`,
    `| Threshold | ${threshold} |`,
    `| Result | ${pass ? '✅ Pass' : '❌ Fail'} |`,
  ];

  if (issues.length > 0) {
    lines.push('', '## Issues', '');
    for (const issue of issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`- ${icon} **${issue.title}** — ${issue.description}`);
    }
  }

  console.log(lines.join('\n'));
}

export function reportDiffMarkdown(diff: DiffResult): void {
  const delta = diff.scoreDelta > 0 ? `+${diff.scoreDelta}` : String(diff.scoreDelta);
  const arrow = diff.scoreDelta > 0 ? '↑' : diff.scoreDelta < 0 ? '↓' : '—';

  const lines: string[] = [
    '# Health Diff',
    '',
    '| Metric | Before | After | Delta |',
    '| --- | --- | --- | --- |',
    `| Score | ${diff.before.score} | ${diff.after.score} | ${delta} ${arrow} |`,
    `| Grade | ${diff.before.grade} | ${diff.after.grade} | |`,
  ];

  if (diff.resolvedIssues.length > 0) {
    lines.push('', '## Resolved', '');
    for (const title of diff.resolvedIssues) {
      lines.push(`- ✅ ${title}`);
    }
  }

  if (diff.newIssues.length > 0) {
    lines.push('', '## New Issues', '');
    for (const title of diff.newIssues) {
      lines.push(`- ❌ ${title}`);
    }
  }

  if (diff.hotspotDiff) {
    const hd = diff.hotspotDiff;
    if (hd.rose.length > 0) {
      lines.push('', '## Hotspots Worsening', '');
      lines.push('| File | Before | After | Δ |');
      lines.push('| --- | ---: | ---: | ---: |');
      for (const d of hd.rose) {
        lines.push(`| \`${d.relativePath}\` | ${d.beforeScore?.toFixed(1)} | ${d.afterScore?.toFixed(1)} | +${d.scoreDelta.toFixed(1)} |`);
      }
    }
    if (hd.appeared.length > 0) {
      lines.push('', '## Newly Risky Files', '');
      lines.push('| File | Score |');
      lines.push('| --- | ---: |');
      for (const d of hd.appeared) {
        lines.push(`| \`${d.relativePath}\` | ${d.afterScore?.toFixed(1)} |`);
      }
    }
    if (hd.fell.length > 0) {
      lines.push('', '## Hotspots Improving', '');
      lines.push('| File | Before | After | Δ |');
      lines.push('| --- | ---: | ---: | ---: |');
      for (const d of hd.fell) {
        lines.push(`| \`${d.relativePath}\` | ${d.beforeScore?.toFixed(1)} | ${d.afterScore?.toFixed(1)} | ${d.scoreDelta.toFixed(1)} |`);
      }
    }
  }

  console.log(lines.join('\n'));
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

export function reportDependenciesMarkdown(report: DependencyReport): void {
  const lines: string[] = ['# Dependency Report', ''];
  lines.push(`- Production: **${report.totalDependencies}** packages`);
  lines.push(`- Development: **${report.totalDevDependencies}** packages`);

  if (report.risks.length > 0) {
    lines.push('');
    lines.push('## Risks');
    for (const risk of report.risks) {
      lines.push(`- **${risk.name}**: ${risk.reason} (${risk.severity})`);
    }
  }

  console.log(lines.join('\n'));
}

export function reportFileMarkdown(insp: FileInspection): void {
  const lines: string[] = [`# File: ${insp.relativePath}`, ''];

  if (!insp.exists) {
    lines.push(`> ${insp.reason ?? 'File unavailable.'}`);
    console.log(lines.join('\n'));
    return;
  }

  lines.push(`**Purpose:** ${insp.purpose}`);
  lines.push(`**Lines:** ${insp.lineCount}  |  **Size:** ${insp.sizeBytes} B`);

  if (insp.hotspot) {
    const h = insp.hotspot;
    lines.push('', '## Risk', '');
    lines.push(`- **Risk score:** ${h.riskScore.toFixed(1)}`);
    lines.push(`- **Commits:** ${h.churn}`);
    lines.push(`- **Authors:** ${h.distinctAuthors}${h.primaryAuthor ? ` (primary: ${h.primaryAuthor}, ${Math.round(h.primaryAuthorShare * 100)}%)` : ''}`);
    if (h.daysSinceLastChange !== null) lines.push(`- **Last change:** ${h.daysSinceLastChange} days ago`);
    if (h.busFactorOne) lines.push('- ⚠️ **Bus factor 1** — only one author has touched this.');
    if (h.reasons.length > 0) lines.push(`- ${h.reasons.join(', ')}`);
  }

  if (insp.issues.length > 0) {
    lines.push('', '## Related Issues', '');
    for (const issue of insp.issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`- ${icon} **${issue.title}** — ${issue.description}`);
    }
  }

  if (insp.potentialIssues.length > 0) {
    lines.push('', '## Potential Issues', '');
    for (const issue of insp.potentialIssues) lines.push(`- ⚠️ ${issue}`);
  }

  if (insp.imports.length > 0) {
    lines.push('', '## Dependencies', '');
    for (const imp of insp.imports) {
      lines.push(`- \`${imp.source}\`${imp.isRelative ? ' (local)' : ''}`);
    }
  }

  if (insp.exports.length > 0) {
    lines.push('', '## Exports', '');
    for (const exp of insp.exports) {
      lines.push(`- \`${exp.name}\` (${exp.type})`);
    }
  }

  console.log(lines.join('\n'));
}

export function reportHotspotsMarkdown(report: HotspotReport): void {
  const lines: string[] = ['# Project Hotspots', ''];

  if (!report.available) {
    lines.push(`> ${report.reason ?? 'Hotspot analysis unavailable.'}`);
    console.log(lines.join('\n'));
    return;
  }

  const { since, commitsScanned } = report.window;
  lines.push(`_Scanned **${commitsScanned}** commit(s) since **${since}** · ranked **${report.totalFilesRanked}** file(s)_`);
  lines.push('');

  if (report.hotspots.length === 0) {
    lines.push('No hotspots detected.');
    console.log(lines.join('\n'));
    return;
  }

  lines.push('| # | Score | File | Churn | Lines | Issues | Reasons |');
  lines.push('| --- | ---: | --- | ---: | ---: | ---: | --- |');
  for (let i = 0; i < report.hotspots.length; i++) {
    const h = report.hotspots[i];
    const reasons = h.reasons.length > 0 ? h.reasons.join(', ') : '—';
    lines.push(
      `| ${i + 1} | ${h.riskScore.toFixed(1)} | \`${h.relativePath}\` | ${h.churn} | ${h.lineCount} | ${h.issueCount} | ${reasons} |`,
    );
  }

  console.log(lines.join('\n'));
}
