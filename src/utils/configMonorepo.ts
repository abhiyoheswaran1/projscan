import type { ImportPolicyRule, ProjscanConfig } from '../types/config.js';

export function applyMonorepo(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!obj.monorepo || typeof obj.monorepo !== 'object') return;
  const m = obj.monorepo as Record<string, unknown>;
  const monorepo: NonNullable<ProjscanConfig['monorepo']> = {};
  if (Array.isArray(m.importPolicy)) {
    const rules = parseImportPolicyRules(m.importPolicy);
    if (rules.length > 0) monorepo.importPolicy = rules;
  }
  if (Object.keys(monorepo).length) out.monorepo = monorepo;
}

function parseImportPolicyRules(raw: unknown[]): ImportPolicyRule[] {
  return raw.map(parseImportPolicyRule).filter(isImportPolicyRule);
}

function parseImportPolicyRule(entry: unknown): ImportPolicyRule | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.from !== 'string' || !e.from) return null;

  const rule: ImportPolicyRule = { from: e.from };
  const allow = stringList(e.allow);
  const deny = stringList(e.deny);
  if (allow) rule.allow = allow;
  if (deny) rule.deny = deny;
  return rule.allow || rule.deny ? rule : null;
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : null;
}

function isImportPolicyRule(rule: ImportPolicyRule | null): rule is ImportPolicyRule {
  return rule !== null;
}
