import type { ProjscanConfig } from '../types/config.js';

export function applyHotspots(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!obj.hotspots || typeof obj.hotspots !== 'object') return;
  const h = obj.hotspots as Record<string, unknown>;
  const hotspots: NonNullable<ProjscanConfig['hotspots']> = {};
  if (typeof h.limit === 'number' && Number.isFinite(h.limit)) {
    hotspots.limit = Math.max(1, Math.min(100, Math.floor(h.limit)));
  }
  if (typeof h.since === 'string' && h.since.trim()) {
    hotspots.since = h.since.trim();
  }
  if (Object.keys(hotspots).length) out.hotspots = hotspots;
}
