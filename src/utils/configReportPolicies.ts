import type { ProjscanConfig, ReportPolicyPreset } from '../types/config.js';

export function applyReportPolicies(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (
    !obj.reportPolicies ||
    typeof obj.reportPolicies !== 'object' ||
    Array.isArray(obj.reportPolicies)
  ) {
    return;
  }
  const raw = obj.reportPolicies as Record<string, unknown>;
  const policies: Record<string, ReportPolicyPreset> = {};

  for (const [rawName, rawPolicy] of Object.entries(raw)) {
    const name = rawName.trim();
    const policy = name ? normalizeReportPolicy(rawPolicy) : null;
    if (policy) policies[name] = policy;
  }

  if (Object.keys(policies).length > 0) out.reportPolicies = policies;
}

function normalizeReportPolicy(rawPolicy: unknown): ReportPolicyPreset | null {
  if (!rawPolicy || typeof rawPolicy !== 'object' || Array.isArray(rawPolicy)) return null;
  const entry = rawPolicy as Record<string, unknown>;
  const policy: ReportPolicyPreset = {};
  if (Array.isArray(entry.reportScope)) {
    const scopes = entry.reportScope.filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    if (scopes.length > 0) policy.reportScope = scopes;
  }
  if (typeof entry.redactPaths === 'boolean') policy.redactPaths = entry.redactPaths;
  return Object.keys(policy).length > 0 ? policy : null;
}
