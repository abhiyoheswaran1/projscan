import type { Issue, IssueLocation } from '../types.js';

export interface CiIssueDetail extends Issue {
  ruleId: string;
  message: string;
  location?: IssueLocation;
  remediation?: string;
}

export function toCiIssueDetail(issue: Issue): CiIssueDetail {
  const location = primaryLocation(issue);
  const remediation = issueRemediation(issue);
  return {
    ...issue,
    ruleId: issue.id,
    message: issue.description,
    ...(location ? { location } : {}),
    ...(remediation ? { remediation } : {}),
  };
}

export function issueRemediation(issue: Issue): string | undefined {
  if (issue.suggestedAction?.summary) return issue.suggestedAction.summary;
  if (issue.fixId) return `Run projscan fix --id ${issue.fixId}.`;
  if (issue.fixAvailable) return 'A projscan fix is available for this issue.';
  return undefined;
}

export function formatIssueLocations(issue: Issue, maxLocations = 6): string | undefined {
  const locations = issue.locations ?? [];
  if (locations.length === 0) return undefined;
  const shown = locations.slice(0, maxLocations).map(formatLocation);
  const overflow = locations.length - shown.length;
  return overflow > 0 ? `${shown.join(', ')} (+${overflow} more)` : shown.join(', ');
}

function primaryLocation(issue: Issue): IssueLocation | undefined {
  return issue.locations?.find((location) => typeof location.line === 'number') ?? issue.locations?.[0];
}

function formatLocation(location: IssueLocation): string {
  const line = typeof location.line === 'number' ? `:${location.line}` : '';
  const column = typeof location.column === 'number' ? `:${location.column}` : '';
  return `${location.file}${line}${column}`;
}
