import chalk from 'chalk';
import type { FixSuggestion, IssueExplanation } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportFixSuggest(result: {
  matched: boolean;
  fix?: FixSuggestion;
  reason?: string;
  synthetic?: boolean;
}): void {
  console.log(header('Fix Suggestion'));
  if (!result.matched || !result.fix) {
    console.log(`\n  ${chalk.yellow('⚠')} ${result.reason ?? 'No suggestion available.'}\n`);
    return;
  }
  printFixSuggestion(result.fix, result.synthetic === true);
}

export function reportExplainIssue(e: IssueExplanation): void {
  console.log(header('Issue Explanation'));
  printIssueIntro(e);
  printIssueExcerpt(e);
  printIssueRelatedIssues(e);
  printIssueSimilarFixes(e);
  printIssueSuggestedAction(e);
}

function printFixSuggestion(fix: FixSuggestion, synthetic: boolean): void {
  printFixIntro(fix, synthetic);
  printFixWhy(fix);
  printFixWhere(fix);
  printFixAction(fix);
  printFixVerify(fix);
  printFixRelatedFiles(fix);
  console.log('');
}

function printFixIntro(fix: FixSuggestion, synthetic: boolean): void {
  const sevColor =
    fix.severity === 'error' ? chalk.red : fix.severity === 'warning' ? chalk.yellow : chalk.dim;
  console.log(`\n  ${chalk.bold(fix.headline)}\n`);
  console.log(
    chalk.dim(
      `  ${sevColor(fix.severity)} · ${fix.category} · ${fix.issueId}${synthetic ? ' (synthetic)' : ''}\n`,
    ),
  );
}

function printFixWhy(fix: FixSuggestion): void {
  console.log(chalk.bold('  Why'));
  for (const line of wrapLines(fix.why, 76)) console.log(`  ${line}`);
}

function printFixWhere(fix: FixSuggestion): void {
  if (fix.where.length === 0) return;
  console.log('\n' + chalk.bold('  Where'));
  for (const w of fix.where) {
    const loc = w.line ? `${w.file}:${w.line}` : w.file;
    console.log(`    ${chalk.cyan(loc)}`);
  }
}

function printFixAction(fix: FixSuggestion): void {
  console.log('\n' + chalk.bold('  Action'));
  for (const line of wrapLines(fix.instruction, 76)) console.log(`  ${line}`);
}

function printFixVerify(fix: FixSuggestion): void {
  if (!fix.suggestedTest) return;
  console.log('\n' + chalk.bold('  Verify'));
  for (const line of wrapLines(fix.suggestedTest, 76)) console.log(`  ${line}`);
}

function printFixRelatedFiles(fix: FixSuggestion): void {
  if (!fix.relatedFiles || fix.relatedFiles.length === 0) return;
  console.log('\n' + chalk.bold('  Related files'));
  for (const f of fix.relatedFiles) console.log(`    ${chalk.cyan(f)}`);
}

function printIssueIntro(e: IssueExplanation): void {
  console.log(`\n  ${chalk.bold(e.title)} ${chalk.dim(`(${e.issueId})`)}`);
  console.log(`  ${chalk.dim(`severity: ${e.severity} · category: ${e.category}`)}\n`);
  console.log(`  ${chalk.bold(e.headline)}\n`);
}

function printIssueExcerpt(e: IssueExplanation): void {
  if (!e.excerpt) return;
  console.log(
    chalk.bold(`  Code (${e.excerpt.file} L${e.excerpt.startLine}-${e.excerpt.endLine})`),
  );
  for (let i = 0; i < e.excerpt.lines.length; i++) {
    const ln = e.excerpt.startLine + i;
    console.log(`    ${chalk.dim(String(ln).padStart(4))}  ${e.excerpt.lines[i]}`);
  }
  console.log('');
}

function printIssueRelatedIssues(e: IssueExplanation): void {
  if (e.relatedIssues.length === 0) return;
  console.log(chalk.bold('  Related issues in the same area:'));
  for (const r of e.relatedIssues) console.log(`    ${chalk.dim('•')} ${r.id}: ${r.title}`);
  console.log('');
}

function printIssueSimilarFixes(e: IssueExplanation): void {
  if (e.similarFixes.length === 0) return;
  console.log(chalk.bold('  Past commits referencing this rule:'));
  for (const f of e.similarFixes)
    console.log(`    ${chalk.dim(f.sha.slice(0, 7))} ${chalk.dim(`(${f.date})`)} ${f.subject}`);
  console.log('');
}

function printIssueSuggestedAction(e: IssueExplanation): void {
  if (!e.fix) return;
  console.log(chalk.bold('  Suggested action:'));
  for (const line of wrapLines(e.fix.instruction, 76)) console.log(`  ${line}`);
  if (e.fix.suggestedTest) {
    console.log('\n  ' + chalk.bold('Verify:') + ' ' + e.fix.suggestedTest);
  }
  console.log('');
}

function wrapLines(text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    if (para.length <= maxWidth) {
      out.push(para);
      continue;
    }
    const words = para.split(/\s+/);
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxWidth) {
        if (cur) out.push(cur);
        cur = w;
      } else {
        cur = cur ? `${cur} ${w}` : w;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}
