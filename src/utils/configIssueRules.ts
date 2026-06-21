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
    .filter((issue) => !isRuleSuppressed(issue, config))
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

function isRuleSuppressed(issue: Issue, config: ProjscanConfig): boolean {
  return isSuppressedByConfigMap(issue, config.suppress ?? {}) || isSuppressedInline(issue, config);
}

function isSuppressedByConfigMap(issue: Issue, suppress: Record<string, string[]>): boolean {
  for (const [rule, patterns] of Object.entries(suppress)) {
    if (!matchesRule(issue.id, rule)) continue;
    if ((issue.locations ?? []).some((location) => matchesAnyPath(location.file, patterns))) {
      return true;
    }
  }
  return false;
}

function isSuppressedInline(issue: Issue, config: ProjscanConfig): boolean {
  for (const location of issue.locations ?? []) {
    const entries = config.inlineSuppressions?.[normalizePath(location.file)] ?? [];
    if (
      entries.some(
        (entry) => entry.line === location.line && entry.rules.some((rule) => matchesRule(issue.id, rule)),
      )
    ) {
      return true;
    }
  }
  return false;
}

function matchesRule(id: string, rule: string): boolean {
  if (rule === '*' || rule === id) return true;
  return rule.endsWith('*') && id.startsWith(rule.slice(0, -1));
}

function matchesAnyPath(file: string, patterns: string[]): boolean {
  const normalized = normalizePath(file);
  return patterns.some((pattern) => matchesPath(normalized, pattern));
}

function matchesPath(file: string, pattern: string): boolean {
  const normalized = normalizePath(pattern);
  if (file === normalized) return true;
  if (!normalized.includes('*')) return false;
  return globToRegExp(normalized).test(file);
}

function globToRegExp(pattern: string): RegExp {
  let source = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*';
        i += 1;
      } else {
        source += '[^/]*';
      }
      continue;
    }
    source += escapeRegExp(char);
  }
  return new RegExp(`${source}$`);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
