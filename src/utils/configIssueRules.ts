import type { Issue } from '../types/common.js';
import type { ProjscanConfig } from '../types/config.js';

/**
 * Apply config rules to a list of issues:
 * - drop issues whose id matches any disableRules entry (exact match or prefix with trailing "*")
 * - remap severities via severityOverrides (exact id match wins)
 */
export function applyConfigToIssues(issues: Issue[], config: ProjscanConfig): Issue[] {
  const disabled = config.disableRules ?? [];
  const overrides = config.severityOverrides ?? {};

  return issues
    .filter((issue) => !isRuleDisabled(issue.id, disabled))
    .map((issue) =>
      overrides[issue.id] && overrides[issue.id] !== issue.severity
        ? { ...issue, severity: overrides[issue.id] }
        : issue,
    );
}

function isRuleDisabled(id: string, disabled: string[]): boolean {
  for (const rule of disabled) {
    if (rule === id) return true;
    if (rule.endsWith('*') && id.startsWith(rule.slice(0, -1))) return true;
  }
  return false;
}
