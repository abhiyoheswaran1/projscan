import type { ProjscanConfig } from '../types/config.js';

export function applyMinScore(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (typeof obj.minScore === 'number' && Number.isFinite(obj.minScore)) {
    out.minScore = Math.max(0, Math.min(100, Math.floor(obj.minScore)));
  }
}

export function applyBaseRef(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (typeof obj.baseRef === 'string' && obj.baseRef.trim()) {
    out.baseRef = obj.baseRef.trim();
  }
}

export function applyIgnore(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!Array.isArray(obj.ignore)) return;
  out.ignore = obj.ignore.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

export function applyDisableRules(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!Array.isArray(obj.disableRules)) return;
  out.disableRules = obj.disableRules.filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
}

export function applySuppress(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!obj.suppress || typeof obj.suppress !== 'object' || Array.isArray(obj.suppress)) return;
  const raw = obj.suppress as Record<string, unknown>;
  const suppress: Record<string, string[]> = {};
  for (const [rule, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    const patterns = value.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (patterns.length > 0) suppress[rule] = patterns;
  }
  if (Object.keys(suppress).length > 0) out.suppress = suppress;
}
