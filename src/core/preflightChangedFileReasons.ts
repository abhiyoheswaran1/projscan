import type { Issue, PreflightMode, PreflightReason } from '../types.js';

interface ChangedFilesEvidence {
  available: boolean;
  count: number;
  files: string[];
  reason?: string;
}

export function changedFileReasons(input: {
  mode: PreflightMode;
  issues: Issue[];
  changedFiles: ChangedFilesEvidence;
  maxChangedFiles: number;
}): PreflightReason[] {
  const reasons: PreflightReason[] = [];
  const issueReason = changedIssueReason(input.mode, input.issues, input.changedFiles);
  const availabilityReason = changedFilesAvailabilityReason(input.mode, input.changedFiles);
  const thresholdReason = changedFilesThresholdReason(
    input.mode,
    input.changedFiles,
    input.maxChangedFiles,
  );

  if (issueReason) reasons.push(issueReason);
  if (availabilityReason) reasons.push(availabilityReason);
  if (thresholdReason) reasons.push(thresholdReason);
  return reasons;
}

function changedIssueReason(
  mode: PreflightMode,
  issues: Issue[],
  changedFiles: ChangedFilesEvidence,
): PreflightReason | undefined {
  if (!hasChangedFileScope(mode, changedFiles)) return undefined;
  const issue = prioritizedChangedIssue(issues, new Set(changedFiles.files));
  if (!issue) return undefined;

  const severity = issue.severity === 'error' ? 'error' : 'warning';
  return {
    severity,
    source: 'doctor',
    issueId: issue.id,
    file: firstIssueFile(issue),
    message: `Health ${severity} on changed file: ${issue.title}`,
    tool: 'projscan_doctor',
  };
}

function changedFilesAvailabilityReason(
  mode: PreflightMode,
  changedFiles: ChangedFilesEvidence,
): PreflightReason | undefined {
  if (!shouldReportChangedFilesUnavailable(mode, changedFiles)) return undefined;
  return changedFilesUnavailableReason(changedFiles.reason);
}

function shouldReportChangedFilesUnavailable(
  mode: PreflightMode,
  changedFiles: ChangedFilesEvidence,
): boolean {
  if (mode === 'before_edit') return false;
  return !changedFiles.available;
}

function changedFilesUnavailableReason(reason?: string): PreflightReason {
  return {
    severity: 'warning',
    source: 'changed-files',
    message: `Changed files unavailable: ${reason ?? 'unknown reason'}`,
    tool: 'projscan_review',
  };
}

function changedFilesThresholdReason(
  mode: PreflightMode,
  changedFiles: ChangedFilesEvidence,
  maxChangedFiles: number,
): PreflightReason | undefined {
  if (!exceedsChangedFileThreshold(mode, changedFiles, maxChangedFiles)) return undefined;
  return {
    severity: 'warning',
    source: 'changed-files',
    message: `${changedFiles.count} changed files exceeds the preflight threshold of ${maxChangedFiles}`,
    tool: 'projscan_review',
  };
}

function hasChangedFileScope(mode: PreflightMode, changedFiles: ChangedFilesEvidence): boolean {
  return mode !== 'before_edit' && changedFiles.available;
}

function exceedsChangedFileThreshold(
  mode: PreflightMode,
  changedFiles: ChangedFilesEvidence,
  maxChangedFiles: number,
): boolean {
  return hasChangedFileScope(mode, changedFiles) && changedFiles.count > maxChangedFiles;
}

function prioritizedChangedIssue(
  issues: Issue[],
  changedFiles: Set<string>,
): Issue | undefined {
  const changedIssues = issues.filter((issue) => issueTouchesChangedFile(issue, changedFiles));
  return (
    changedIssues.find((issue) => issue.severity === 'error') ??
    changedIssues.find((issue) => issue.severity === 'warning')
  );
}

function issueTouchesChangedFile(issue: Issue, changedFiles: Set<string>): boolean {
  return (issue.locations ?? []).some(
    (location) => location.file && changedFiles.has(location.file),
  );
}

function firstIssueFile(issue: Issue): string | undefined {
  return issue.locations?.find((location) => location.file)?.file;
}
