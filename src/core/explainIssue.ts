import { spawn } from 'node:child_process';
import type { Issue, IssueExplanation, IssueLocation } from '../types.js';
import { readExcerpt, suggestFixForIssue, previewSuggestionForIssue } from './fixSuggest.js';

const SIMILAR_FIXES_LIMIT = 5;
const GIT_LOG_TIMEOUT_MS = 5_000;

/**
 * Build a markdown-friendly deep-dive for one open issue. Used by
 * `projscan_explain_issue` (MCP) and `projscan explain-issue` (CLI). Reads
 * the surrounding code, finds related issues touching the same file, and
 * scans git log for past commits that mention the rule by id - useful when
 * the team has a precedent for handling this issue type.
 */
export async function explainIssue(
  rootPath: string,
  allIssues: Issue[],
  issueId: string,
): Promise<IssueExplanation | null> {
  const issue = allIssues.find((i) => i.id === issueId);
  if (!issue) return null;

  const primary = pickPrimaryLocation(issue.locations);
  const excerpt = primary ? await readExcerpt(rootPath, primary, 3) : null;

  // Other issues touching the same primary file.
  const relatedIssues = primary
    ? allIssues
        .filter(
          (other) =>
            other.id !== issue.id &&
            (other.locations ?? []).some((l) => l.file === primary.file),
        )
        .slice(0, 10)
        .map((o) => ({ id: o.id, title: o.title }))
    : [];

  const similarFixes = await searchGitLogForRule(rootPath, ruleKey(issue.id));

  const fix = await suggestFixForIssue(issue, rootPath);
  const headline = previewSuggestionForIssue(issue)?.summary ?? issue.title;

  return {
    issueId: issue.id,
    title: issue.title,
    severity: issue.severity,
    category: issue.category,
    headline,
    excerpt,
    relatedIssues,
    similarFixes,
    fix,
  };
}

function pickPrimaryLocation(locations?: IssueLocation[]): IssueLocation | null {
  if (!locations || locations.length === 0) return null;
  // First location with a line number wins; otherwise first overall.
  const withLine = locations.find((l) => typeof l.line === 'number');
  return withLine ?? locations[0];
}

/**
 * Strip trailing numeric / hash suffixes so a per-instance id like
 * `cycle-detected-3` matches commits mentioning `cycle-detected`. Falls
 * back to the original id when there's no obvious suffix.
 */
function ruleKey(issueId: string): string {
  // unused-dependency-foo, cycle-detected-3, dep-risk-moment, audit-axios
  // Strip a trailing numeric or single-segment lower/upper-case word so we get
  // the rule prefix; if the suffix is itself meaningful (e.g. dep name), the
  // longer id is also tried below.
  const match = /^([a-z][a-z0-9-]*?)(?:-[A-Za-z0-9_./@-]+)?$/.exec(issueId);
  // Take the first 2 segments as the most stable rule key.
  const segs = issueId.split('-');
  if (segs.length <= 2) return match ? match[1] : issueId;
  return segs.slice(0, 2).join('-');
}

interface GitLogEntry {
  sha: string;
  date: string;
  subject: string;
}

async function searchGitLogForRule(rootPath: string, rule: string): Promise<GitLogEntry[]> {
  // git log --grep=<rule> --max-count=N --pretty=%H|%ad|%s --date=short
  return new Promise((resolve) => {
    const args = [
      'log',
      `--grep=${rule}`,
      `--max-count=${SIMILAR_FIXES_LIMIT}`,
      '--pretty=%H|%ad|%s',
      '--date=short',
      '--no-merges',
    ];
    const child = spawn('git', args, { cwd: rootPath, env: process.env });
    let stdout = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      resolve([]);
    }, GIT_LOG_TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.on('error', () => {
      clearTimeout(timer);
      resolve([]);
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (timedOut) return;
      const out: GitLogEntry[] = [];
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        const [sha, date, ...rest] = line.split('|');
        if (!sha || !date) continue;
        out.push({ sha, date, subject: rest.join('|') });
      }
      resolve(out);
    });
  });
}
