import type { Issue } from '../types.js';

export interface ChangedIssueFilterResult {
  issues: Issue[];
  dropped: number;
  unlocated: number;
}

export function filterIssuesToChangedFiles(
  issues: Issue[],
  changedFiles: string[],
): ChangedIssueFilterResult {
  const changedFileSet = new Set(changedFiles);
  const filtered = issues.filter((issue) =>
    (issue.locations ?? []).some((location) => changedFileSet.has(location.file)),
  );

  return {
    issues: filtered,
    dropped: issues.length - filtered.length,
    unlocated: issues.filter((issue) => !issue.locations || issue.locations.length === 0).length,
  };
}

export function changedFilesUnavailableMessage(reason?: string): string {
  return `  [--changed-only: ${reason ?? 'unavailable'} - reporting all issues]`;
}

export function changedFilesAvailableMessage(baseRef: string | null, fileCount: number): string {
  return `  [--changed-only: base=${baseRef}, ${fileCount} file(s)]`;
}

export function changedIssueFilterMessage(result: ChangedIssueFilterResult): string | null {
  if (result.dropped <= 0) return null;
  if (result.unlocated > 0) {
    return `  [--changed-only: ${result.dropped} issue(s) filtered out; ${result.unlocated} had no file location]`;
  }
  return `  [--changed-only: ${result.dropped} issue(s) outside the changed-file set]`;
}
