import type { FileInspection } from '../types.js';

export function reportFileMarkdown(insp: FileInspection): void {
  const lines: string[] = [`# File: ${insp.relativePath}`, ''];
  if (!insp.exists) {
    lines.push(`> ${insp.reason ?? 'File unavailable.'}`);
    console.log(lines.join('\n'));
    return;
  }
  appendFileSummary(lines, insp);
  appendFileHotspot(lines, insp);
  appendFileIssues(lines, insp);
  appendFilePotentialIssues(lines, insp);
  appendFileImports(lines, insp);
  appendFileExports(lines, insp);
  appendFileFunctions(lines, insp);
  appendFileSuggestedActions(lines, insp);
  console.log(lines.join('\n'));
}

function appendFileSummary(lines: string[], insp: FileInspection): void {
  lines.push(`**Purpose:** ${insp.purpose}`);
  lines.push(`**Lines:** ${insp.lineCount}  |  **Size:** ${insp.sizeBytes} B`);
  if (typeof insp.cyclomaticComplexity === 'number') {
    lines.push(`**Cyclomatic complexity:** ${insp.cyclomaticComplexity}`);
  }
  if (typeof insp.fanIn === 'number' || typeof insp.fanOut === 'number') {
    lines.push(`**Coupling:** fan-in ${insp.fanIn ?? '-'}, fan-out ${insp.fanOut ?? '-'}`);
  }
}

function appendFileHotspot(lines: string[], insp: FileInspection): void {
  if (!insp.hotspot) return;
  const h = insp.hotspot;
  lines.push('', '## Risk', '');
  lines.push(`- **Risk score:** ${h.riskScore.toFixed(1)}`);
  lines.push(`- **Commits:** ${h.churn}`);
  const primary = h.primaryAuthor
    ? ` (primary: ${h.primaryAuthor}, ${Math.round(h.primaryAuthorShare * 100)}%)`
    : '';
  lines.push(`- **Authors:** ${h.distinctAuthors}${primary}`);
  if (h.daysSinceLastChange !== null) {
    lines.push(`- **Last change:** ${h.daysSinceLastChange} days ago`);
  }
  if (h.busFactorOne) lines.push('- ⚠️ **Bus factor 1** - only one author has touched this.');
  if (h.reasons.length > 0) lines.push(`- ${h.reasons.join(', ')}`);
}

function appendFileIssues(lines: string[], insp: FileInspection): void {
  if (insp.issues.length === 0) return;
  lines.push('', '## Related Issues', '');
  for (const issue of insp.issues) {
    const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
    lines.push(`- ${icon} **${issue.title}** - ${issue.description}`);
  }
}

function appendFilePotentialIssues(lines: string[], insp: FileInspection): void {
  if (insp.potentialIssues.length === 0) return;
  lines.push('', '## Potential Issues', '');
  for (const issue of insp.potentialIssues) lines.push(`- ⚠️ ${issue}`);
}

function appendFileImports(lines: string[], insp: FileInspection): void {
  if (insp.imports.length === 0) return;
  lines.push('', '## Dependencies', '');
  for (const imp of insp.imports) {
    lines.push(`- \`${imp.source}\`${imp.isRelative ? ' (local)' : ''}`);
  }
}

function appendFileExports(lines: string[], insp: FileInspection): void {
  if (insp.exports.length === 0) return;
  lines.push('', '## Exports', '');
  for (const exp of insp.exports) {
    lines.push(`- \`${exp.name}\` (${exp.type})`);
  }
}

function appendFileFunctions(lines: string[], insp: FileInspection): void {
  if (!insp.functions || insp.functions.length === 0) return;
  lines.push('', '## Functions (top by CC)', '');
  lines.push('| CC | Fan-in | Name | Lines |');
  lines.push('| ---: | ---: | --- | --- |');
  for (const fn of insp.functions.slice(0, 20)) {
    const fi = typeof fn.fanIn === 'number' ? String(fn.fanIn) : '-';
    lines.push(
      `| ${fn.cyclomaticComplexity} | ${fi} | \`${fn.name}\` | L${fn.line}-${fn.endLine} |`,
    );
  }
  if (insp.functions.length > 20) {
    lines.push('', `_... and ${insp.functions.length - 20} more_`);
  }
}

function appendFileSuggestedActions(lines: string[], insp: FileInspection): void {
  if (!insp.suggestedNextActions || insp.suggestedNextActions.length === 0) return;
  lines.push('', '## Next Actions', '');
  for (const action of insp.suggestedNextActions) {
    lines.push(
      action.command
        ? `- **${action.label}:** \`${action.command}\``
        : `- **${action.label}**`,
    );
  }
}
