import type { CouplingReport } from '../types.js';

export function reportCouplingMarkdown(report: CouplingReport): void {
  const lines: string[] = ['# Coupling + Cycles', ''];

  appendGraphTotals(lines, report);
  appendCycles(lines, report);
  appendCrossPackageEdges(lines, report);
  appendFiles(lines, report);

  console.log(lines.join('\n'));
}

function appendGraphTotals(lines: string[], report: CouplingReport): void {
  const xpkg = report.totalCrossPackageEdges;
  lines.push(
    `_${report.totalFiles} file(s) in graph · ${report.totalCycles} cycle(s)${xpkg > 0 ? ` · ${xpkg} cross-package edge(s)` : ''}_`,
    '',
  );
}

function appendCycles(lines: string[], report: CouplingReport): void {
  if (report.cycles.length > 0) {
    lines.push('## Import cycles', '');
    for (const c of report.cycles) {
      lines.push(`- **${c.size}-file cycle:** ${c.files.map((f) => `\`${f}\``).join(' → ')} → …`);
    }
    lines.push('');
  }
}

function appendCrossPackageEdges(lines: string[], report: CouplingReport): void {
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
}

function appendFiles(lines: string[], report: CouplingReport): void {
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
}
