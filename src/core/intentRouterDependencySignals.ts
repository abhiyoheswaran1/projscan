const DEPENDENCY_CYCLE_KEYWORDS = ['dependency', 'dependencies', 'deps', 'package', 'packages'];
const DEPENDENCY_INVENTORY_KEYWORDS = [
  'dependencies',
  'dependency',
  'deps',
  'packages',
  'inventory',
  'declared',
  'supply-chain',
];
const DEPENDENCY_BLOAT_KEYWORDS = [
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
];
const DEPENDENCY_LICENSE_KEYWORDS = [
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
];
const DEPENDENCY_LICENSE_CONTEXT_KEYWORDS = [
  'license',
  'licenses',
  'gpl',
  'copyleft',
  'notice',
  'notices',
  'third',
  'party',
  'dependency',
  'dependencies',
  'package',
  'packages',
];
const COUPLING_DIRECT_KEYWORDS = [
  'circular',
  'cycle',
  'cycles',
  'coupling',
  'coupled',
  'instability',
];
const ARCHITECTURE_SUBJECT_KEYWORDS = [
  'dependency',
  'dependencies',
  'import',
  'imports',
  'module',
  'modules',
  'architecture',
  'boundary',
  'boundaries',
];
const COUPLING_SIGNAL_KEYWORDS = ['coupling', 'coupled', 'tightly', 'instability', 'fan'];
const COUPLING_DEPENDENCY_KEYWORDS = ['dependency', 'dependencies', 'import', 'imports'];
const COUPLING_ARCHITECTURE_KEYWORDS = [
  'module',
  'modules',
  'architecture',
  'boundary',
  'boundaries',
];

export function auditKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const auditSignal = [
    'audit',
    'cve',
    'cves',
    'vulnerable',
    'vulnerability',
    'vulnerabilities',
  ].some((token) => tokens.has(token));
  const dependencyContext = ['dependency', 'dependencies', 'package', 'packages', 'npm'].some(
    (token) => tokens.has(token),
  );
  const securityContext = ['security', 'secure', 'safe'].some((token) => tokens.has(token));
  if (['audit', 'cve', 'cves', 'vulnerable', 'vulnerability', 'vulnerabilities'].includes(keyword))
    return true;
  if (['security', 'secure', 'safe'].includes(keyword)) return auditSignal || dependencyContext;
  if (['dependency', 'dependencies', 'package', 'packages', 'npm'].includes(keyword)) {
    return auditSignal || securityContext || tokens.has('audit');
  }
  return false;
}

export function packageImporterContextMatches(tokens: Set<string>): boolean {
  return (
    (tokens.has('import') || tokens.has('imports') || tokens.has('importers')) &&
    (tokens.has('package') || tokens.has('dependency')) &&
    ['who', 'which', 'what', 'files'].some((token) => tokens.has(token))
  );
}

export function packageDependencyLookupContextMatches(
  tokens: Set<string>,
  hasFilePath: boolean,
): boolean {
  if (hasFilePath) return false;
  const lookupSignal = ['who', 'what', 'which', 'why'].some((token) => tokens.has(token));
  const dependencySignal = ['uses', 'depend', 'depends', 'installed'].some((token) =>
    tokens.has(token),
  );
  return lookupSignal && dependencySignal;
}

export function outdatedNpmContextMatches(tokens: Set<string>): boolean {
  return [
    'dependency',
    'dependencies',
    'outdated',
    'audit',
    'upgrade',
    'vulnerable',
    'vulnerability',
    'vulnerabilities',
    'package',
    'packages',
  ].some((token) => tokens.has(token));
}

export function pythonUpgradeCoverageContextMatches(tokens: Set<string>): boolean {
  const upgradeSignal = ['upgrade', 'upgrading', 'bump', 'update'].some((token) =>
    tokens.has(token),
  );
  const pythonDependencyContext = [
    'python',
    'poetry',
    'pyproject',
    'requirements',
    'requirement',
    'pip',
    'pipenv',
    'pinned',
  ].some((token) => tokens.has(token));
  return tokens.has('coverage') && upgradeSignal && pythonDependencyContext;
}

export function workspacesKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const workspaceContext = ['workspace', 'workspaces', 'monorepo'].some((token) =>
    tokens.has(token),
  );
  const packageContext = ['package', 'packages'].some((token) => tokens.has(token));
  const mapContext = ['map', 'list', 'owns', 'contains', 'put', 'change'].some((token) =>
    tokens.has(token),
  );
  if (['workspace', 'workspaces', 'monorepo'].includes(keyword)) return true;
  if (['package', 'packages'].includes(keyword)) return workspaceContext || mapContext;
  if (['map', 'list', 'owns', 'contains', 'put', 'change'].includes(keyword))
    return workspaceContext || packageContext;
  return false;
}

export function dependenciesKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (dependencyCycleContextMatches(tokens) && DEPENDENCY_CYCLE_KEYWORDS.includes(keyword))
    return false;
  if (DEPENDENCY_INVENTORY_KEYWORDS.includes(keyword)) return true;
  const licenseContext = hasAnyToken(tokens, DEPENDENCY_LICENSE_KEYWORDS);
  const bloatContext = dependencyBloatContextMatches(tokens);
  if (DEPENDENCY_BLOAT_KEYWORDS.includes(keyword)) return bloatContext;
  if (keyword === 'package') return licenseContext || bloatContext;
  if (!licenseContext) return false;
  return dependencyLicenseKeywordMatches(keyword, tokens);
}

export function couplingKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (COUPLING_DIRECT_KEYWORDS.includes(keyword)) return true;
  if (keyword === 'tightly') return tokens.has('coupled');
  if (keyword === 'fan') return fanKeywordMatches(tokens);
  if (COUPLING_DEPENDENCY_KEYWORDS.includes(keyword)) return dependencyCouplingKeywordMatches(tokens);
  if (COUPLING_ARCHITECTURE_KEYWORDS.includes(keyword))
    return architectureCouplingKeywordMatches(tokens);
  return fallbackCouplingKeywordMatches(tokens);
}

export function dependencyCycleContextMatches(tokens: Set<string>): boolean {
  return hasArchitectureSubject(tokens) && (hasCycleSignal(tokens) || hasCouplingSignal(tokens));
}

export function dependencyBloatContextMatches(tokens: Set<string>): boolean {
  const bloatSignal = hasAnyToken(tokens, DEPENDENCY_BLOAT_KEYWORDS);
  const packageSubject = [
    'dependency',
    'dependencies',
    'deps',
    'package',
    'packages',
    'bundle',
    'bundles',
    'app',
  ].some((token) => tokens.has(token));
  return bloatSignal && packageSubject;
}

function dependencyLicenseKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (keyword === 'source')
    return (
      tokens.has('open') || tokens.has('compliance') || hasAnyToken(tokens, ['license', 'licenses'])
    );
  if (keyword === 'open') return tokens.has('source') || tokens.has('compliance');
  if (keyword === 'compliance') {
    return (
      (tokens.has('open') && tokens.has('source')) ||
      hasAnyToken(tokens, DEPENDENCY_LICENSE_CONTEXT_KEYWORDS)
    );
  }
  if (['third', 'party'].includes(keyword)) return hasThirdPartyLicenseContext(tokens);
  return true;
}

function fanKeywordMatches(tokens: Set<string>): boolean {
  return hasArchitectureSubject(tokens) || tokens.has('out') || tokens.has('in');
}

function dependencyCouplingKeywordMatches(tokens: Set<string>): boolean {
  return (
    dependencyCycleContextMatches(tokens) ||
    (hasCouplingSignal(tokens) && hasArchitectureSubject(tokens))
  );
}

function architectureCouplingKeywordMatches(tokens: Set<string>): boolean {
  return hasCycleSignal(tokens) || hasCouplingSignal(tokens);
}

function fallbackCouplingKeywordMatches(tokens: Set<string>): boolean {
  return hasCycleSignal(tokens) || (hasCouplingSignal(tokens) && hasArchitectureSubject(tokens));
}

function hasThirdPartyLicenseContext(tokens: Set<string>): boolean {
  return (
    tokens.has('third') &&
    tokens.has('party') &&
    hasAnyToken(tokens, ['notice', 'notices', 'license', 'licenses', 'compliance'])
  );
}

function hasCycleSignal(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['circular', 'cycle', 'cycles']);
}

function hasCouplingSignal(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, COUPLING_SIGNAL_KEYWORDS);
}

function hasArchitectureSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ARCHITECTURE_SUBJECT_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
