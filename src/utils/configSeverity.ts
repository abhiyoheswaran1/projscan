import type { IssueSeverity } from '../types/common.js';
import type { ProjscanConfig } from '../types/config.js';

const VALID_SEVERITIES: IssueSeverity[] = ['info', 'warning', 'error'];

export function applySeverityOverrides(
  obj: Record<string, unknown>,
  out: ProjscanConfig,
): void {
  if (!obj.severityOverrides || typeof obj.severityOverrides !== 'object') return;
  const raw = obj.severityOverrides as Record<string, unknown>;
  const overrides: Record<string, IssueSeverity> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'string' && (VALID_SEVERITIES as string[]).includes(val)) {
      overrides[key] = val as IssueSeverity;
    }
  }
  if (Object.keys(overrides).length) out.severityOverrides = overrides;
}
