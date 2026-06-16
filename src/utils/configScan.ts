import type { ProjscanConfig } from '../types/config.js';

export function applyScan(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!obj.scan || typeof obj.scan !== 'object') return;
  const raw = obj.scan as Record<string, unknown>;
  const scan: NonNullable<ProjscanConfig['scan']> = {};
  if (typeof raw.includeIgnored === 'boolean') scan.includeIgnored = raw.includeIgnored;
  if (typeof raw.scanEnvValues === 'boolean') scan.scanEnvValues = raw.scanEnvValues;
  if (typeof raw.offline === 'boolean') scan.offline = raw.offline;
  if (Object.keys(scan).length) out.scan = scan;
}
