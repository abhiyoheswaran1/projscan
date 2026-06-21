const FILE_WEIGHT_FIVE_KEYWORDS = new Set(['review', 'reviewer', 'reviewers']);

const FILE_WEIGHT_TWO_KEYWORDS = new Set([
  'file',
  'explain',
  'inspect',
  'owns',
  'risk',
  'risks',
  'risky',
  'dangerous',
  'last',
  'touched',
  'touch',
  'changed',
  'recently',
  'history',
  'author',
  'authors',
  'blame',
  'add',
  'write',
  'coverage',
  'covered',
  'uncovered',
  'test',
  'tests',
]);

const IMPACT_WEIGHT_TWO_KEYWORDS = new Set([
  'delete',
  'remove',
  'drop',
  'schema',
  'table',
  'column',
  'database',
  'db',
  'migration',
  'migrations',
  'revert',
  'rollback',
  'undo',
  'backout',
  'back',
  'out',
  'recover',
  'depends',
  'used',
  'usage',
  'referenced',
  'called',
  'api',
  'apis',
  'endpoint',
  'endpoints',
  'client',
  'clients',
  'contract',
  'contracts',
  'deprecate',
  'deprecates',
  'deprecated',
  'deprecation',
  'compatibility',
  'compatible',
  'version',
  'versions',
]);

const IMPACT_WEIGHT_THREE_KEYWORDS = new Set(['change', 'changes', 'changing']);

export function fileImpactKeywordWeight(tool: string, keyword: string): number | undefined {
  if (tool === 'projscan_file') return fileKeywordWeight(keyword);
  if (tool === 'projscan_impact') return impactKeywordWeight(keyword);
  return undefined;
}

function fileKeywordWeight(keyword: string): number | undefined {
  if (keyword === 'read') return 3;
  if (FILE_WEIGHT_FIVE_KEYWORDS.has(keyword)) return 5;
  if (FILE_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  return undefined;
}

function impactKeywordWeight(keyword: string): number | undefined {
  if (IMPACT_WEIGHT_THREE_KEYWORDS.has(keyword)) return 3;
  if (IMPACT_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  return undefined;
}
