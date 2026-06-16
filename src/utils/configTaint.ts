import type { ProjscanConfig } from '../types/config.js';

export function applyTaint(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!obj.taint || typeof obj.taint !== 'object') return;
  const t = obj.taint as Record<string, unknown>;
  const taint: NonNullable<ProjscanConfig['taint']> = {};
  if (Array.isArray(t.sources)) {
    taint.sources = t.sources.filter((v): v is string => typeof v === 'string' && v.length > 0);
  }
  if (Array.isArray(t.sinks)) {
    taint.sinks = t.sinks.filter((v): v is string => typeof v === 'string' && v.length > 0);
  }
  if (Object.keys(taint).length) out.taint = taint;
}
