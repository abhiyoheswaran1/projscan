import type { Issue, PreflightReason } from '../types.js';

export function policyIssueReasons(issues: Issue[]): PreflightReason[] {
  return [...supplyChainIssueReasons(issues), ...pluginIssueReasons(issues)];
}

function supplyChainIssueReasons(issues: Issue[]): PreflightReason[] {
  return issues.filter(isSupplyChainIssue).map(supplyChainIssueReason);
}

function pluginIssueReasons(issues: Issue[]): PreflightReason[] {
  return issues.filter(isPluginIssue).map(pluginIssueReason);
}

function isSupplyChainIssue(issue: Issue): boolean {
  return issue.category === 'supply-chain';
}

function isPluginIssue(issue: Issue): boolean {
  return issue.id.startsWith('plugin:');
}

function supplyChainIssueReason(issue: Issue): PreflightReason {
  return {
    severity: issue.severity,
    source: 'supply-chain',
    issueId: issue.id,
    file: firstIssueFile(issue),
    message: `${issue.severity === 'error' ? 'Supply-chain gate blocks' : 'Supply-chain gate flags'} ${issue.id}: ${issue.title}`,
    tool: 'projscan_doctor',
  };
}

function pluginIssueReason(issue: Issue): PreflightReason {
  return {
    severity: issue.severity,
    source: 'plugin',
    issueId: issue.id,
    file: firstIssueFile(issue),
    message: `${issue.severity === 'error' ? 'Plugin policy blocks' : 'Plugin policy flags'} ${issue.id}: ${issue.title}`,
    tool: 'projscan_plugin',
  };
}

function firstIssueFile(issue: Issue): string | undefined {
  return issue.locations?.find((location) => location.file)?.file;
}
