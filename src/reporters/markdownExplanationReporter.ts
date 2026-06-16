import type { FileExplanation } from '../types.js';

export function reportExplanationMarkdown(explanation: FileExplanation): void {
  const lines: string[] = [`# File: ${explanation.filePath}`, ''];

  lines.push(`**Purpose:** ${explanation.purpose}`);
  lines.push(`**Lines:** ${explanation.lineCount}`);
  appendDependencies(lines, explanation);
  appendExports(lines, explanation);
  appendPotentialIssues(lines, explanation);

  console.log(lines.join('\n'));
}

function appendDependencies(lines: string[], explanation: FileExplanation): void {
  if (explanation.imports.length === 0) return;
  lines.push('');
  lines.push('## Dependencies');
  for (const imp of explanation.imports) {
    lines.push(`- \`${imp.source}\`${imp.isRelative ? ' (local)' : ''}`);
  }
}

function appendExports(lines: string[], explanation: FileExplanation): void {
  if (explanation.exports.length === 0) return;
  lines.push('');
  lines.push('## Exports');
  for (const exp of explanation.exports) {
    lines.push(`- \`${exp.name}\` (${exp.type})`);
  }
}

function appendPotentialIssues(lines: string[], explanation: FileExplanation): void {
  if (explanation.potentialIssues.length === 0) return;
  lines.push('');
  lines.push('## Potential Issues');
  for (const issue of explanation.potentialIssues) {
    lines.push(`- ⚠️ ${issue}`);
  }
}
