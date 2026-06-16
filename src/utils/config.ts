import fs from 'node:fs/promises';
import path from 'node:path';
import type { Issue } from '../types/common.js';
import type { LoadedConfig, ProjscanConfig } from '../types/config.js';
import { applyHotspots } from './configHotspots.js';
import { applyMonorepo } from './configMonorepo.js';
import { applyReportPolicies } from './configReportPolicies.js';
import { applyScan } from './configScan.js';
import { applySeverityOverrides } from './configSeverity.js';
import { applyTaint } from './configTaint.js';

const CONFIG_CANDIDATES = ['.projscanrc.json', '.projscanrc'];
const PKG_KEY = 'projscan';

export async function loadConfig(rootPath: string, explicitPath?: string): Promise<LoadedConfig> {
  if (explicitPath) {
    const resolved = path.isAbsolute(explicitPath)
      ? explicitPath
      : path.join(rootPath, explicitPath);
    const raw = await fs.readFile(resolved, 'utf-8');
    const parsed = safeParse(raw, resolved);
    return { config: normalize(parsed), source: resolved };
  }

  for (const name of CONFIG_CANDIDATES) {
    const candidate = path.join(rootPath, name);
    let raw: string;
    try {
      raw = await fs.readFile(candidate, 'utf-8');
    } catch {
      // File not present - try next candidate.
      continue;
    }
    const parsed = safeParse(raw, candidate);
    return { config: normalize(parsed), source: candidate };
  }

  // Try package.json "projscan" key
  const pkgPath = path.join(rootPath, 'package.json');
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const embedded = pkg[PKG_KEY];
    if (embedded && typeof embedded === 'object') {
      return { config: normalize(embedded), source: `${pkgPath}#${PKG_KEY}` };
    }
  } catch {
    // No package.json or unreadable
  }

  return { config: {}, source: null };
}

function safeParse(raw: string, filePath: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${filePath}: ${msg}`, { cause: err });
  }
}

function normalize(input: unknown): ProjscanConfig {
  if (!input || typeof input !== 'object') return {};
  const obj = input as Record<string, unknown>;
  const out: ProjscanConfig = {};
  applyMinScore(obj, out);
  applyBaseRef(obj, out);
  applyHotspots(obj, out);
  applyIgnore(obj, out);
  applyScan(obj, out);
  applyDisableRules(obj, out);
  applySeverityOverrides(obj, out);
  applyReportPolicies(obj, out);
  applyMonorepo(obj, out);
  applyTaint(obj, out);
  return out;
}

function applyMinScore(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (typeof obj.minScore === 'number' && Number.isFinite(obj.minScore)) {
    out.minScore = Math.max(0, Math.min(100, Math.floor(obj.minScore)));
  }
}

function applyBaseRef(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (typeof obj.baseRef === 'string' && obj.baseRef.trim()) {
    out.baseRef = obj.baseRef.trim();
  }
}

function applyIgnore(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!Array.isArray(obj.ignore)) return;
  out.ignore = obj.ignore.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function applyDisableRules(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!Array.isArray(obj.disableRules)) return;
  out.disableRules = obj.disableRules.filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
}

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
