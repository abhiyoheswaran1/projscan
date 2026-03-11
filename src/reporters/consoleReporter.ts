import chalk from 'chalk';
import type {
  AnalysisReport,
  Issue,
  Fix,
  FixResult,
  FileExplanation,
  ArchitectureLayer,
  DirectoryNode,
  DependencyReport,
} from '../types.js';

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
  console.log(header('DevLens Project Report'));

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
    console.log(`\n  Run ${chalk.bold.cyan('devlens fix')} to auto-fix these issues.`);
  }

  console.log('');
}

// ── Report: doctor ────────────────────────────────────────

export function reportHealth(issues: Issue[], scanTimeMs?: number): void {
  console.log(header('Project Health Report'));

  if (issues.length === 0) {
    console.log(`\n  ${chalk.green('✓')} ${chalk.bold('No issues detected!')} Your project looks healthy.\n`);
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
  console.log(`\n  Found ${parts.join(', ')}`);

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
    console.log(`\n  Run ${chalk.bold.cyan('devlens fix')} to auto-fix ${fixable.length} issue${fixable.length > 1 ? 's' : ''}.\n`);
  }

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
      console.log(`  ${chalk.red('✗')} ${result.fix.title} — ${chalk.dim(result.error ?? 'unknown error')}`);
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
