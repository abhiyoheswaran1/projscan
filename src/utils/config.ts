import type { LoadedConfig, ProjscanConfig } from '../types/config.js';
import {
  applyBaseRef,
  applyDisableRules,
  applyFailOn,
  applyIgnore,
  applyMinScore,
  applySuppress,
} from './configBasics.js';
import { applyHotspots } from './configHotspots.js';
import { applyMonorepo } from './configMonorepo.js';
import { applyProofRecipes } from './configProofRecipes.js';
import { applyReportPolicies } from './configReportPolicies.js';
import { applyScan } from './configScan.js';
import { applySeverityOverrides } from './configSeverity.js';
import { loadConfigSource } from './configSources.js';
import { applyTaint } from './configTaint.js';

export { applyConfigToIssues } from './configIssueRules.js';

export async function loadConfig(rootPath: string, explicitPath?: string): Promise<LoadedConfig> {
  const source = await loadConfigSource(rootPath, explicitPath);
  if (!source) return { config: {}, source: null };
  return { config: normalize(source.value), source: source.source };
}

function normalize(input: unknown): ProjscanConfig {
  if (!input || typeof input !== 'object') return {};
  const obj = input as Record<string, unknown>;
  const out: ProjscanConfig = {};
  applyMinScore(obj, out);
  applyFailOn(obj, out);
  applyBaseRef(obj, out);
  applyHotspots(obj, out);
  applyIgnore(obj, out);
  applyScan(obj, out);
  applyDisableRules(obj, out);
  applySuppress(obj, out);
  applySeverityOverrides(obj, out);
  applyReportPolicies(obj, out);
  applyProofRecipes(obj, out);
  applyMonorepo(obj, out);
  applyTaint(obj, out);
  return out;
}
