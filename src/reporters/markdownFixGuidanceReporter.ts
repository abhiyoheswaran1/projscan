import type { FixSuggestion, IssueExplanation } from '../types.js';

export function reportFixSuggestMarkdown(result: {
  matched: boolean;
  fix?: FixSuggestion;
  reason?: string;
  synthetic?: boolean;
}): void {
  const lines: string[] = ['# Fix Suggestion', ''];
  if (!result.matched || !result.fix) {
    lines.push(`> ${result.reason ?? 'No suggestion available.'}`);
    console.log(lines.join('\n'));
    return;
  }
  appendFixSuggestion(lines, result.fix, result.synthetic === true);
  console.log(lines.join('\n'));
}

function appendFixSuggestion(lines: string[], fix: FixSuggestion, synthetic: boolean): void {
  appendFixIntro(lines, fix, synthetic);
  appendFixWhere(lines, fix);
  appendFixAction(lines, fix);
  appendFixRelatedFiles(lines, fix);
  appendFixReferences(lines, fix);
}

function appendFixIntro(lines: string[], fix: FixSuggestion, synthetic: boolean): void {
  lines.push(`**${fix.headline}**`, '');
  lines.push(
    `_severity: ${fix.severity} · category: ${fix.category} · issue: \`${fix.issueId}\`${synthetic ? ' (synthetic)' : ''}_`,
    '',
  );
  lines.push('## Why', '', fix.why, '');
}

function appendFixWhere(lines: string[], fix: FixSuggestion): void {
  if (fix.where.length > 0) {
    lines.push('## Where', '');
    for (const w of fix.where) {
      const loc = w.line ? `${w.file}:${w.line}` : w.file;
      lines.push(`- \`${loc}\``);
    }
    lines.push('');
  }
}

function appendFixAction(lines: string[], fix: FixSuggestion): void {
  lines.push('## Action', '', fix.instruction, '');
  if (fix.suggestedTest) lines.push('## Verify', '', fix.suggestedTest, '');
}

function appendFixRelatedFiles(lines: string[], fix: FixSuggestion): void {
  if (fix.relatedFiles && fix.relatedFiles.length > 0) {
    lines.push('## Related files', '');
    for (const f of fix.relatedFiles) lines.push(`- \`${f}\``);
    lines.push('');
  }
}

function appendFixReferences(lines: string[], fix: FixSuggestion): void {
  if (fix.references && fix.references.length > 0) {
    lines.push('## References', '');
    for (const r of fix.references) lines.push(`- ${r}`);
    lines.push('');
  }
}

export function reportExplainIssueMarkdown(e: IssueExplanation): void {
  const lines: string[] = [`# Issue: ${e.title}`, ''];
  lines.push(`_severity: ${e.severity} · category: ${e.category} · id: \`${e.issueId}\`_`, '');
  lines.push(`**${e.headline}**`, '');
  appendIssueExcerpt(lines, e);
  appendIssueRelatedIssues(lines, e);
  appendIssueSimilarFixes(lines, e);
  appendIssueSuggestedAction(lines, e);
  console.log(lines.join('\n'));
}

function appendIssueExcerpt(lines: string[], e: IssueExplanation): void {
  if (e.excerpt) {
    lines.push(
      `## Code (\`${e.excerpt.file}\` L${e.excerpt.startLine}-${e.excerpt.endLine})`,
      '',
      '```',
    );
    for (const l of e.excerpt.lines) lines.push(l);
    lines.push('```', '');
  }
}

function appendIssueRelatedIssues(lines: string[], e: IssueExplanation): void {
  if (e.relatedIssues.length > 0) {
    lines.push('## Related issues in the same area', '');
    for (const r of e.relatedIssues) lines.push(`- \`${r.id}\`: ${r.title}`);
    lines.push('');
  }
}

function appendIssueSimilarFixes(lines: string[], e: IssueExplanation): void {
  if (e.similarFixes.length > 0) {
    lines.push('## Past commits referencing this rule', '');
    for (const f of e.similarFixes) lines.push(`- ${f.sha.slice(0, 7)} (${f.date}) ${f.subject}`);
    lines.push('');
  }
}

function appendIssueSuggestedAction(lines: string[], e: IssueExplanation): void {
  if (e.fix) {
    lines.push('## Suggested action', '', e.fix.instruction, '');
    if (e.fix.suggestedTest) lines.push('**Verify:** ' + e.fix.suggestedTest, '');
  }
}
