const DEPENDENCY_WEIGHT_TWO_KEYWORDS = new Set([
  'dependencies',
  'dependency',
  'deps',
  'package',
  'packages',
  'inventory',
  'declared',
  'bundle',
  'bundles',
  'size',
  'sizes',
  'large',
  'heavy',
  'bloat',
  'bloated',
  'weight',
  'footprint',
  'reduce',
  'slim',
  'license',
  'licenses',
  'gpl',
  'copyleft',
  'notice',
  'notices',
  'third',
  'party',
  'open',
  'source',
  'compliance',
]);

const WORKSPACE_WEIGHT_TWO_KEYWORDS = new Set([
  'workspace',
  'workspaces',
  'monorepo',
  'package',
  'packages',
  'map',
  'list',
  'owns',
  'contains',
  'put',
  'change',
]);

const UPGRADE_WEIGHT_TWO_KEYWORDS = new Set([
  'upgrade',
  'bump',
  'update',
  'remove',
  'drop',
  'uninstall',
  'package',
]);

const AUDIT_WEIGHT_TWO_KEYWORDS = new Set([
  'audit',
  'cve',
  'cves',
  'vulnerable',
  'vulnerability',
  'vulnerabilities',
  'security',
  'secure',
  'safe',
]);

const AUDIT_WEIGHT_ONE_KEYWORDS = new Set([
  'dependency',
  'dependencies',
  'package',
  'packages',
  'npm',
]);

export function dependencyKeywordWeight(tool: string, keyword: string): number | undefined {
  if (tool === 'projscan_dependencies') return dependencyInventoryKeywordWeight(keyword);
  if (tool === 'projscan_workspaces') return workspaceKeywordWeight(keyword);
  if (tool === 'projscan_upgrade') return upgradeKeywordWeight(keyword);
  if (tool === 'projscan_audit') return auditKeywordWeight(keyword);
  return undefined;
}

function dependencyInventoryKeywordWeight(keyword: string): number | undefined {
  return DEPENDENCY_WEIGHT_TWO_KEYWORDS.has(keyword) ? 2 : undefined;
}

function workspaceKeywordWeight(keyword: string): number | undefined {
  return WORKSPACE_WEIGHT_TWO_KEYWORDS.has(keyword) ? 2 : undefined;
}

function upgradeKeywordWeight(keyword: string): number | undefined {
  return UPGRADE_WEIGHT_TWO_KEYWORDS.has(keyword) ? 2 : undefined;
}

function auditKeywordWeight(keyword: string): number | undefined {
  if (AUDIT_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  if (AUDIT_WEIGHT_ONE_KEYWORDS.has(keyword)) return 1;
  return undefined;
}
