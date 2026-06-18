import type { Issue, IssueSeverity } from '../types.js';

export function isWellShapedIssue(x: unknown): x is Issue {
  if (!x || typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  return hasIssueIdentity(obj) && hasIssueMetadata(obj) && hasIssueFixFlag(obj);
}

function hasIssueIdentity(obj: Record<string, unknown>): boolean {
  return typeof obj.id === 'string' && obj.id.length > 0;
}

function hasIssueMetadata(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.title === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.category === 'string' &&
    isSeverity(obj.severity)
  );
}

function hasIssueFixFlag(obj: Record<string, unknown>): boolean {
  return typeof obj.fixAvailable === 'boolean';
}

function isSeverity(x: unknown): x is IssueSeverity {
  return x === 'error' || x === 'warning' || x === 'info';
}
