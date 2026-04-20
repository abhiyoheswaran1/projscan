import chalk from 'chalk';
import type {
  AnalysisReport,
  AuditReport,
  CoverageJoinedReport,
  Issue,
  Fix,
  FixResult,
  FileExplanation,
  FileInspection,
  ArchitectureLayer,
  DirectoryNode,
  DependencyReport,
  DiffResult,
  HotspotReport,
  OutdatedReport,
  UpgradePreview,
} from '../types.js';
import { calculateScore } from '../utils/scoreCalculator.js';

// ── Helpers ───────────────────────────────────────────────

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return chalk.red('✗');
    case 'warning':
      return chalk.yellow('⚠');
    case 'info':
      return chalk.blue('ℹ');
    default:
      return chalk.dim('·');
  }
}

function bar(percentage: number, width = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

// ── Report: analyze ───────────────────────────────────────

export function reportAnalysis(report: AnalysisReport): void {
  console.log(header('ProjScan Project Report'));

  // Project info
  console.log(header('Project'));
  console.log(`  Name:          ${chalk.bold(report.projectName)}`);
  console.log(`  Language:      ${chalk.bold(report.languages.primary)}`);

  const frameworkNames = report.frameworks.frameworks.map((f) => f.name).join(', ');
  if (frameworkNames) {
    console.log(`  Frameworks:    ${chalk.bold(frameworkNames)}`);
  }

  if (report.frameworks.packageManager !== 'unknown') {
    console.log(`  Pkg Manager:   ${report.frameworks.packageManager}`);
  }

  if (report.dependencies) {
    console.log(
      `  Dependencies:  ${report.dependencies.totalDependencies} prod, ${report.dependencies.totalDevDependencies} dev`,
    );
  }

  console.log(`  Files:         ${report.scan.totalFiles}`);
  console.log(`  Directories:   ${report.scan.totalDirectories}`);
  console.log(`  Scan Time:     ${report.scan.scanDurationMs.toFixed(0)}ms`);

  // Languages
  const langEntries = Object.values(report.languages.languages)
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 8);

  if (langEntries.length > 0) {
    console.log(header('Languages'));
    for (const lang of langEntries) {
      const pct = lang.percentage.toFixed(1).padStart(5);
      console.log(`  ${bar(lang.percentage)} ${pct}%  ${lang.name} (${lang.fileCount} files)`);
    }
  }

  // Structure (top-level dirs)
  if (report.scan.directoryTree.children.length > 0) {
    console.log(header('Structure'));
    for (const child of report.scan.directoryTree.children.slice(0, 12)) {
      const count = chalk.dim(`(${child.totalFileCount} files)`);
      console.log(`  ${chalk.bold(child.name + '/')}  ${count}`);
    }
  }

  // Issues
  if (report.issues.length > 0) {
    console.log(header('Issues'));
    for (const issue of report.issues) {
      console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
    }
  }

  // Suggestions
  const fixableIssues = report.issues.filter((i) => i.fixAvailable);
  if (fixableIssues.length > 0) {
    console.log(header('Suggestions'));
    for (const issue of fixableIssues) {
      console.log(`  ${chalk.green('•')} ${issue.description}`);
    }
    console.log(`\n  Run ${chalk.bold.cyan('projscan fix')} to auto-fix these issues.`);
  }

  console.log('');
}

// ── Report: doctor ────────────────────────────────────────

export function reportHealth(issues: Issue[], scanTimeMs?: number): void {
  console.log(header('Project Health Report'));

  const { score, grade } = calculateScore(issues);
  const gradeColor = grade === 'A' ? chalk.green : grade === 'B' ? chalk.green : grade === 'C' ? chalk.yellow : grade === 'D' ? chalk.yellow : chalk.red;
  console.log(`\n  Health Score: ${gradeColor(chalk.bold(`${grade} (${score}/100)`))}`);

  if (issues.length === 0) {
    console.log(`  ${chalk.green('✓')} ${chalk.bold('No issues detected!')} Your project looks healthy.\n`);
    return;
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  // Summary
  const parts: string[] = [];
  if (errors.length > 0) parts.push(chalk.red(`${errors.length} error${errors.length > 1 ? 's' : ''}`));
  if (warnings.length > 0) parts.push(chalk.yellow(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`));
  if (infos.length > 0) parts.push(chalk.blue(`${infos.length} info`));
  console.log(`  Found ${parts.join(', ')}`);

  if (scanTimeMs !== undefined) {
    console.log(`  Scanned in ${chalk.dim(scanTimeMs.toFixed(0) + 'ms')}`);
  }

  // Issues
  console.log(header('Issues Detected'));
  for (const issue of issues) {
    console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
    console.log(`    ${chalk.dim(issue.description)}`);
  }

  // Recommendations
  const fixable = issues.filter((i) => i.fixAvailable);
  if (fixable.length > 0) {
    console.log(header('Recommendations'));
    for (let i = 0; i < fixable.length; i++) {
      console.log(`  ${chalk.bold(String(i + 1) + '.')} Fix: ${fixable[i].title}`);
    }
    console.log(`\n  Run ${chalk.bold.cyan('projscan fix')} to auto-fix ${fixable.length} issue${fixable.length > 1 ? 's' : ''}.\n`);
  }

  console.log('');
}

// ── Report: ci ────────────────────────────────────────────

export function reportCi(issues: Issue[], threshold: number): void {
  const { score, grade, errors, warnings, infos } = calculateScore(issues);
  const pass = score >= threshold;
  const status = pass ? chalk.green('PASS') : chalk.red('FAIL');
  const gradeColor = grade === 'A' || grade === 'B' ? chalk.green : grade === 'C' ? chalk.yellow : chalk.red;

  console.log(
    `projscan: ${gradeColor(chalk.bold(`${grade} (${score}/100)`))} - ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}, ${infos} info - ${status} (threshold: ${threshold})`,
  );

  if (!pass) {
    for (const issue of issues) {
      console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
    }
  }
}

// ── Report: diff ──────────────────────────────────────────

export function reportDiff(diff: DiffResult): void {
  console.log(header('Health Diff'));

  const arrow = diff.scoreDelta > 0 ? chalk.green('↑') : diff.scoreDelta < 0 ? chalk.red('↓') : chalk.dim('-');
  const delta = diff.scoreDelta > 0 ? `+${diff.scoreDelta}` : String(diff.scoreDelta);

  console.log(`\n  Score: ${diff.before.score} → ${diff.after.score} (${delta})  ${arrow}`);
  console.log(`  Grade: ${diff.before.grade} → ${diff.after.grade}`);

  if (diff.resolvedIssues.length > 0) {
    console.log(`\n  ${chalk.green('✓')} Resolved (${diff.resolvedIssues.length}):`);
    for (const title of diff.resolvedIssues) {
      console.log(`    ${chalk.green('-')} ${title}`);
    }
  }

  if (diff.newIssues.length > 0) {
    console.log(`\n  ${chalk.red('✗')} New (${diff.newIssues.length}):`);
    for (const title of diff.newIssues) {
      console.log(`    ${chalk.red('-')} ${title}`);
    }
  }

  if (diff.resolvedIssues.length === 0 && diff.newIssues.length === 0) {
    console.log(`\n  ${chalk.dim('No change in issues.')}`);
  }

  if (diff.hotspotDiff) {
    const hd = diff.hotspotDiff;
    const total = hd.rose.length + hd.fell.length + hd.appeared.length + hd.resolved.length;
    if (total > 0) {
      console.log(header('Hotspot Changes'));
      if (hd.rose.length > 0) {
        console.log(`\n  ${chalk.red('▲')} Worsening (${hd.rose.length}):`);
        for (const delta of hd.rose.slice(0, 10)) {
          console.log(
            `    ${chalk.red('+' + delta.scoreDelta.toFixed(1))}  ${delta.relativePath}  ${chalk.dim(`${delta.beforeScore?.toFixed(1)} → ${delta.afterScore?.toFixed(1)}`)}`,
          );
        }
      }
      if (hd.appeared.length > 0) {
        console.log(`\n  ${chalk.yellow('●')} Newly risky (${hd.appeared.length}):`);
        for (const delta of hd.appeared.slice(0, 10)) {
          console.log(`    ${chalk.yellow(delta.afterScore?.toFixed(1) ?? '?')}  ${delta.relativePath}`);
        }
      }
      if (hd.fell.length > 0) {
        console.log(`\n  ${chalk.green('▼')} Improving (${hd.fell.length}):`);
        for (const delta of hd.fell.slice(0, 10)) {
          console.log(
            `    ${chalk.green(delta.scoreDelta.toFixed(1))}  ${delta.relativePath}  ${chalk.dim(`${delta.beforeScore?.toFixed(1)} → ${delta.afterScore?.toFixed(1)}`)}`,
          );
        }
      }
      if (hd.resolved.length > 0) {
        console.log(`\n  ${chalk.green('✓')} No longer tracked (${hd.resolved.length}):`);
        for (const delta of hd.resolved.slice(0, 5)) {
          console.log(`    ${chalk.green('-')}  ${delta.relativePath}`);
        }
      }
    }
  }

  console.log(`\n  Baseline: ${chalk.dim(diff.before.timestamp)}`);
  console.log('');
}

// ── Report: fix ───────────────────────────────────────────

export function reportDetectedIssues(issues: Issue[], fixes: Fix[]): void {
  console.log(header('Detected Issues'));
  for (const issue of issues.filter((i) => i.fixAvailable)) {
    console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
  }

  console.log(header('Proposed Fixes'));
  for (let i = 0; i < fixes.length; i++) {
    console.log(`  ${chalk.bold(String(i + 1) + '.')} ${fixes[i].title}`);
  }
  console.log('');
}

export function reportFixResults(results: FixResult[]): void {
  console.log('');
  for (const result of results) {
    if (result.success) {
      console.log(`  ${chalk.green('✔')} ${result.fix.title}`);
    } else {
      console.log(`  ${chalk.red('✗')} ${result.fix.title} - ${chalk.dim(result.error ?? 'unknown error')}`);
    }
  }
  console.log('');
}

// ── Report: explain ───────────────────────────────────────

export function reportExplanation(explanation: FileExplanation): void {
  console.log(header('File Explanation'));

  console.log(`\n  ${chalk.bold('File:')}    ${explanation.filePath}`);
  console.log(`  ${chalk.bold('Lines:')}   ${explanation.lineCount}`);
  console.log(`  ${chalk.bold('Purpose:')} ${explanation.purpose}`);

  if (explanation.imports.length > 0) {
    console.log(header('Dependencies'));
    for (const imp of explanation.imports) {
      const prefix = imp.isRelative ? chalk.dim('(local)') : chalk.cyan('(package)');
      console.log(`  ${prefix} ${imp.source}`);
    }
  }

  if (explanation.exports.length > 0) {
    console.log(header('Key Exports'));
    for (const exp of explanation.exports) {
      const typeLabel = chalk.dim(`[${exp.type}]`);
      console.log(`  ${chalk.green('→')} ${exp.name} ${typeLabel}`);
    }
  }

  if (explanation.potentialIssues.length > 0) {
    console.log(header('Potential Issues'));
    for (const issue of explanation.potentialIssues) {
      console.log(`  ${chalk.yellow('⚠')} ${issue}`);
    }
  }

  console.log('');
}

// ── Report: diagram ───────────────────────────────────────

export function reportDiagram(layers: ArchitectureLayer[]): void {
  console.log(header('Project Architecture'));
  console.log('');

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const isLast = i === layers.length - 1;
    const connector = isLast ? '└' : '├';
    const techStr = layer.technologies.length > 0 ? layer.technologies.join(' / ') : 'Unknown';

    console.log(`  ${chalk.bold(layer.name)}`);
    console.log(`  ${connector}─ ${chalk.cyan(techStr)}`);

    if (layer.directories.length > 0) {
      for (let j = 0; j < layer.directories.length; j++) {
        const dirConnector = j === layer.directories.length - 1 ? '└' : '├';
        const prefix = isLast ? '   ' : '│  ';
        console.log(`  ${prefix}${dirConnector}─ ${chalk.dim(layer.directories[j])}`);
      }
    }

    if (!isLast) console.log('  │');
  }

  console.log('');
}

// ── Report: structure ─────────────────────────────────────

export function reportStructure(tree: DirectoryNode, projectName?: string): void {
  console.log(header('Project Structure'));
  console.log(`\n  ${chalk.bold(projectName ?? tree.name + '/')} ${chalk.dim(`(${tree.totalFileCount} files)`)}`);
  printTree(tree.children, '  ');
  console.log('');
}

function printTree(nodes: DirectoryNode[], indent: string): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childIndent = isLast ? '    ' : '│   ';
    const count = chalk.dim(`(${node.totalFileCount} files)`);

    console.log(`${indent}${connector}${chalk.bold(node.name + '/')} ${count}`);

    if (node.children.length > 0) {
      printTree(node.children, indent + childIndent);
    }
  }
}

// ── Report: dependencies ──────────────────────────────────

export function reportDependencies(report: DependencyReport): void {
  console.log(header('Dependency Report'));

  console.log(`\n  Production:    ${chalk.bold(String(report.totalDependencies))} packages`);
  console.log(`  Development:   ${chalk.bold(String(report.totalDevDependencies))} packages`);
  console.log(`  Total:         ${chalk.bold(String(report.totalDependencies + report.totalDevDependencies))} packages`);

  if (Object.keys(report.dependencies).length > 0) {
    console.log(header('Production Dependencies'));
    const deps = Object.entries(report.dependencies).sort(([a], [b]) => a.localeCompare(b));
    for (const [name, version] of deps.slice(0, 25)) {
      console.log(`  ${chalk.dim('•')} ${name} ${chalk.dim(version)}`);
    }
    if (deps.length > 25) {
      console.log(`  ${chalk.dim(`... and ${deps.length - 25} more`)}`);
    }
  }

  if (report.risks.length > 0) {
    console.log(header('Risks'));
    for (const risk of report.risks) {
      const icon = risk.severity === 'high' ? chalk.red('✗') : chalk.yellow('⚠');
      console.log(`  ${icon} ${risk.name}: ${risk.reason}`);
    }
  }

  console.log('');
}

// ── Report: hotspots ──────────────────────────────────────

export function reportHotspots(report: HotspotReport): void {
  console.log(header('Project Hotspots'));

  if (!report.available) {
    console.log(`\n  ${chalk.yellow('⚠')} ${report.reason ?? 'Hotspot analysis unavailable.'}\n`);
    return;
  }

  if (report.hotspots.length === 0) {
    console.log(`\n  ${chalk.green('✓')} No hotspots detected.`);
    console.log(chalk.dim(`  Scanned ${report.window.commitsScanned} commit${report.window.commitsScanned === 1 ? '' : 's'} since ${report.window.since}.\n`));
    return;
  }

  console.log(
    chalk.dim(
      `\n  ${report.window.commitsScanned} commit${report.window.commitsScanned === 1 ? '' : 's'} since ${report.window.since} · ${report.totalFilesRanked} file${report.totalFilesRanked === 1 ? '' : 's'} ranked\n`,
    ),
  );

  const maxScore = report.hotspots[0]?.riskScore ?? 1;
  for (let i = 0; i < report.hotspots.length; i++) {
    const h = report.hotspots[i];
    const rank = chalk.bold(String(i + 1).padStart(2, ' ') + '.');
    const scoreLabel = chalk.bold(h.riskScore.toFixed(1).padStart(5, ' '));
    const barPct = Math.min(100, Math.round((h.riskScore / maxScore) * 100));
    console.log(`  ${rank} ${scoreLabel}  ${bar(barPct, 14)}  ${chalk.cyan(h.relativePath)}`);
    const reasonStr = h.reasons.length > 0 ? h.reasons.join(', ') : 'ranked by risk';
    console.log(`       ${chalk.dim(reasonStr)}`);
  }

  console.log(chalk.dim(`\n  Tip: run ${chalk.bold.cyan('projscan file <file>')} to drill into a hotspot.\n`));
}

// ── Report: file (drill-down) ─────────────────────────────

export function reportFileInspection(insp: FileInspection): void {
  console.log(header('File Report'));

  if (!insp.exists) {
    console.log(`\n  ${chalk.red('✗')} ${insp.reason ?? 'File unavailable.'}\n`);
    return;
  }

  console.log(`\n  ${chalk.bold('File:')}     ${insp.relativePath}`);
  console.log(`  ${chalk.bold('Purpose:')}  ${insp.purpose}`);
  console.log(`  ${chalk.bold('Lines:')}    ${insp.lineCount}`);
  console.log(`  ${chalk.bold('Size:')}     ${formatSize(insp.sizeBytes)}`);

  if (insp.hotspot) {
    const h = insp.hotspot;
    console.log(header('Risk'));
    console.log(`  ${chalk.bold('Risk Score:')}  ${chalk.bold(h.riskScore.toFixed(1))}`);
    console.log(`  ${chalk.bold('Commits:')}     ${h.churn}`);
    console.log(
      `  ${chalk.bold('Authors:')}     ${h.distinctAuthors}${
        h.primaryAuthor ? ` (primary: ${formatAuthorEmail(h.primaryAuthor)}, ${Math.round(h.primaryAuthorShare * 100)}%)` : ''
      }`,
    );
    if (h.daysSinceLastChange !== null) {
      console.log(`  ${chalk.bold('Last change:')} ${h.daysSinceLastChange} days ago`);
    }
    if (h.busFactorOne) {
      console.log(`  ${chalk.red('⚠')} Bus factor 1 - only one author has touched this.`);
    }
    if (h.reasons.length > 0) {
      console.log(`  ${chalk.dim(h.reasons.join(', '))}`);
    }
  } else {
    console.log(chalk.dim('\n  No hotspot data (file is untouched in git window or outside analysis scope).'));
  }

  if (insp.issues.length > 0) {
    console.log(header('Related Issues'));
    for (const issue of insp.issues) {
      console.log(`  ${severityIcon(issue.severity)} ${issue.title}`);
    }
  }

  if (insp.potentialIssues.length > 0) {
    console.log(header('Potential Issues'));
    for (const issue of insp.potentialIssues) {
      console.log(`  ${chalk.yellow('⚠')} ${issue}`);
    }
  }

  if (insp.imports.length > 0) {
    console.log(header('Dependencies'));
    for (const imp of insp.imports.slice(0, 20)) {
      const prefix = imp.isRelative ? chalk.dim('(local)') : chalk.cyan('(package)');
      console.log(`  ${prefix} ${imp.source}`);
    }
    if (insp.imports.length > 20) {
      console.log(chalk.dim(`  ... and ${insp.imports.length - 20} more`));
    }
  }

  if (insp.exports.length > 0) {
    console.log(header('Exports'));
    for (const exp of insp.exports) {
      console.log(`  ${chalk.dim('•')} ${chalk.bold(exp.name)} ${chalk.dim(`(${exp.type})`)}`);
    }
  }

  console.log('');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Report: outdated ──────────────────────────────────────

const DRIFT_COLORS = {
  major: chalk.red,
  minor: chalk.yellow,
  patch: chalk.blue,
  same: chalk.dim,
  unknown: chalk.dim,
};

export function reportOutdated(report: OutdatedReport): void {
  if (!report.available) {
    console.log(chalk.yellow(`\n  ${report.reason}\n`));
    return;
  }

  const drifting = report.packages.filter((p) => p.drift !== 'same' && p.drift !== 'unknown');
  const missing = report.packages.filter((p) => !p.installed);

  console.log(header('Outdated Packages'));
  console.log(
    `  ${chalk.bold(report.totalPackages)} declared · ${chalk.bold(drifting.length)} drifted · ${chalk.bold(missing.length)} not installed\n`,
  );

  if (drifting.length === 0 && missing.length === 0) {
    console.log(`  ${chalk.green('✓')} All declared packages match installed versions.\n`);
    return;
  }

  // Group by drift
  for (const level of ['major', 'minor', 'patch'] as const) {
    const pkgs = drifting.filter((p) => p.drift === level);
    if (pkgs.length === 0) continue;
    const colour = DRIFT_COLORS[level];
    console.log(`  ${colour.bold(level.toUpperCase())} (${pkgs.length})`);
    for (const p of pkgs) {
      const scope = p.scope === 'devDependency' ? chalk.dim(' [dev]') : '';
      console.log(
        `    ${chalk.bold(p.name.padEnd(30))} ${chalk.dim(p.declared)} → ${colour(p.installed ?? '?')}${scope}`,
      );
    }
    console.log('');
  }

  if (missing.length > 0) {
    console.log(`  ${chalk.dim('Not installed')} (${missing.length})`);
    for (const p of missing.slice(0, 10)) {
      console.log(`    ${chalk.dim(p.name)} ${chalk.dim(p.declared)}`);
    }
    if (missing.length > 10) console.log(`    ${chalk.dim(`… and ${missing.length - 10} more`)}`);
    console.log('');
  }
}

// ── Report: audit ─────────────────────────────────────────

const SEVERITY_COLORS = {
  critical: chalk.red.bold,
  high: chalk.red,
  moderate: chalk.yellow,
  low: chalk.blue,
  info: chalk.dim,
};

export function reportAudit(report: AuditReport): void {
  if (!report.available) {
    console.log(chalk.yellow(`\n  ${report.reason}\n`));
    return;
  }

  console.log(header('Vulnerability Audit'));
  const { summary, findings } = report;
  const total = summary.critical + summary.high + summary.moderate + summary.low + summary.info;

  if (total === 0) {
    console.log(`  ${chalk.green('✓')} ${chalk.bold('No known vulnerabilities.')}\n`);
    return;
  }

  console.log(
    `  ${SEVERITY_COLORS.critical(`${summary.critical} critical`)} · ` +
      `${SEVERITY_COLORS.high(`${summary.high} high`)} · ` +
      `${SEVERITY_COLORS.moderate(`${summary.moderate} moderate`)} · ` +
      `${SEVERITY_COLORS.low(`${summary.low} low`)} · ` +
      `${SEVERITY_COLORS.info(`${summary.info} info`)}\n`,
  );

  for (const f of findings.slice(0, 30)) {
    const colour = SEVERITY_COLORS[f.severity];
    const fix = f.fixAvailable ? chalk.green(' (fix available)') : '';
    console.log(`  ${colour(`[${f.severity.toUpperCase()}]`)} ${chalk.bold(f.name)}${fix}`);
    console.log(`    ${f.title}`);
    if (f.range) console.log(`    ${chalk.dim(`range: ${f.range}`)}`);
    if (f.url) console.log(`    ${chalk.dim(f.url)}`);
    console.log('');
  }

  if (findings.length > 30) {
    console.log(chalk.dim(`  … and ${findings.length - 30} more. Use --format json for full list.\n`));
  }

  console.log(chalk.dim('  Tip: run `npm audit fix` to auto-apply safe upgrades.\n'));
}

// ── Report: upgrade ───────────────────────────────────────

export function reportUpgrade(preview: UpgradePreview): void {
  if (!preview.available) {
    console.log(chalk.yellow(`\n  ${preview.reason ?? 'Upgrade preview unavailable'}\n`));
    return;
  }

  console.log(header(`Upgrade Preview - ${preview.name}`));
  const drift = DRIFT_COLORS[preview.drift] ?? chalk.dim;
  console.log(`  Declared:  ${chalk.dim(preview.declared ?? '-')}`);
  console.log(`  Installed: ${chalk.bold(preview.installed ?? '-')}`);
  console.log(`  Drift:     ${drift(preview.drift.toUpperCase())}`);
  console.log('');

  if (preview.breakingMarkers.length > 0) {
    console.log(chalk.red.bold('  ⚠ Breaking-change markers detected:'));
    for (const m of preview.breakingMarkers) {
      console.log(`    ${chalk.red('•')} ${m.slice(0, 100)}`);
    }
    console.log('');
  } else {
    console.log(chalk.green('  ✓ No obvious breaking-change markers detected.\n'));
  }

  if (preview.importers.length > 0) {
    console.log(chalk.bold(`  Importers (${preview.importers.length}):`));
    for (const file of preview.importers.slice(0, 15)) {
      console.log(`    ${chalk.dim('•')} ${file}`);
    }
    if (preview.importers.length > 15) {
      console.log(chalk.dim(`    … and ${preview.importers.length - 15} more`));
    }
    console.log('');
  } else {
    console.log(chalk.dim('  No direct importers found in source.\n'));
  }

  if (preview.changelogExcerpt) {
    console.log(chalk.bold('  CHANGELOG excerpt:'));
    const lines = preview.changelogExcerpt.split('\n').slice(0, 40);
    for (const line of lines) console.log(`    ${chalk.dim(line)}`);
    console.log('');
  } else {
    console.log(chalk.dim('  No local CHANGELOG found (node_modules/<pkg>/CHANGELOG.md).\n'));
  }
}

// ── Report: coverage × hotspots ───────────────────────────

export function reportCoverage(report: CoverageJoinedReport): void {
  if (!report.available) {
    console.log(chalk.yellow(`\n  ${report.reason ?? 'Coverage report unavailable'}\n`));
    return;
  }

  console.log(header('Coverage × Hotspots - "Scariest Untested Files"'));
  const src = report.coverageSourceFile ? ` (${report.coverageSourceFile})` : '';
  console.log(chalk.dim(`  Source: ${report.coverageSource}${src}`));
  console.log('');

  if (report.entries.length === 0) {
    console.log(`  ${chalk.green('✓')} No hotspots intersected with coverage data.\n`);
    return;
  }

  for (const e of report.entries.slice(0, 20)) {
    const covStr = e.coverage === null ? chalk.dim('n/a') : formatCoverage(e.coverage);
    const pri = chalk.bold(e.priority.toFixed(1).padStart(6));
    console.log(
      `  ${pri}  cov ${covStr}  risk ${chalk.dim(e.riskScore.toFixed(1))}  churn ${chalk.dim(String(e.churn))}  ${chalk.bold(e.relativePath)}`,
    );
    if (e.reasons.length > 0) {
      console.log(`         ${chalk.dim(e.reasons.join(', '))}`);
    }
  }

  if (report.entries.length > 20) {
    console.log(chalk.dim(`\n  … and ${report.entries.length - 20} more.\n`));
  } else {
    console.log('');
  }
}

function formatCoverage(pct: number): string {
  const padded = `${pct.toFixed(0)}%`.padStart(4);
  if (pct < 40) return chalk.red(padded);
  if (pct < 70) return chalk.yellow(padded);
  if (pct < 90) return chalk.blue(padded);
  return chalk.green(padded);
}

function formatAuthorEmail(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}
