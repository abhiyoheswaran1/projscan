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
