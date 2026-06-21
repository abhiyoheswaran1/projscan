const SEMANTIC_GRAPH_WEIGHT_TWO_KEYWORDS = new Set([
  'import',
  'imports',
  'importers',
  'exports',
  'defined',
  'definition',
  'uses',
  'depend',
  'depends',
  'installed',
]);

const COUPLING_WEIGHT_TWO_KEYWORDS = new Set([
  'coupling',
  'coupled',
  'tightly',
  'module',
  'modules',
  'dependency',
  'dependencies',
  'import',
  'imports',
  'fan',
  'instability',
  'architecture',
  'boundary',
  'boundaries',
]);

const COUPLING_WEIGHT_THREE_KEYWORDS = new Set(['circular', 'cycle', 'cycles']);

const COVERAGE_WEIGHT_TWO_KEYWORDS = new Set([
  'coverage',
  'untested',
  'uncovered',
  'scariest',
  'gap',
  'gaps',
  'test',
  'tests',
  'file',
  'files',
  'no',
  'missing',
  'without',
]);

export function architectureKeywordWeight(tool: string, keyword: string): number | undefined {
  if (tool === 'projscan_explain_issue' && keyword === 'explain') return 2;
  if (tool === 'projscan_semantic_graph') return semanticGraphKeywordWeight(keyword);
  if (tool === 'projscan_coupling') return couplingKeywordWeight(keyword);
  if (tool === 'projscan_coverage') return coverageKeywordWeight(keyword);
  return undefined;
}

function semanticGraphKeywordWeight(keyword: string): number | undefined {
  return SEMANTIC_GRAPH_WEIGHT_TWO_KEYWORDS.has(keyword) ? 2 : undefined;
}

function couplingKeywordWeight(keyword: string): number | undefined {
  if (COUPLING_WEIGHT_THREE_KEYWORDS.has(keyword)) return 3;
  if (COUPLING_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  return undefined;
}

function coverageKeywordWeight(keyword: string): number | undefined {
  return COVERAGE_WEIGHT_TWO_KEYWORDS.has(keyword) ? 2 : undefined;
}
