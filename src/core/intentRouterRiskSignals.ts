import { regressionPerformanceContextMatches } from './intentRouterRegressionSignals.js';
import { localServiceSetupCommandContextMatches } from './intentRouterRepoSignals.js';

export function fileHistoryContextMatches(tokens: Set<string>): boolean {
  return [
    'last',
    'recently',
    'history',
    'author',
    'authors',
    'blame',
    'touched',
    'touch',
    'changed',
  ].some((token) => tokens.has(token));
}

export function fileTestContextMatches(tokens: Set<string>): boolean {
  if (['coverage', 'covered', 'uncovered', 'add', 'write'].some((token) => tokens.has(token)))
    return true;
  const testQuestion = tokens.has('test') || tokens.has('tests');
  const runOrLocationQuestion = ['run', 'rerun', 'where', 'find', 'locate', 'search'].some(
    (token) => tokens.has(token),
  );
  return testQuestion && !runOrLocationQuestion;
}

export function impactDeleteContextMatches(tokens: Set<string>): boolean {
  return [
    'impact',
    'breaks',
    'break',
    'blast',
    'radius',
    'depends',
    'affect',
    'callers',
    'used',
    'usage',
    'referenced',
    'called',
    'breaking',
    'dead',
    'unused',
    'orphaned',
  ].some((token) => tokens.has(token));
}

export function impactDatabaseContextMatches(tokens: Set<string>): boolean {
  const databaseSubject = ['database', 'db', 'schema', 'table', 'column', 'sql'].some((token) =>
    tokens.has(token),
  );
  const destructiveSubject = ['drop', 'schema', 'table', 'column', 'sql'].some((token) =>
    tokens.has(token),
  );
  const migrationSubject = tokens.has('migration') || tokens.has('migrations');
  const migrationImpactSignal = [
    'impact',
    'breaks',
    'break',
    'breaking',
    'blast',
    'radius',
    'affect',
    'drop',
    'delete',
    'remove',
    'rollback',
    'revert',
  ].some((token) => tokens.has(token));
  const breakQuestion = ['breaks', 'break', 'breaking'].some((token) => tokens.has(token));
  return (
    destructiveSubject ||
    (databaseSubject && breakQuestion) ||
    (migrationSubject && migrationImpactSignal)
  );
}

export function impactApiKeywordMatches(keyword: string): boolean {
  return [
    'api',
    'apis',
    'endpoint',
    'endpoints',
    'client',
    'clients',
    'contract',
    'contracts',
    'change',
    'changes',
    'changing',
    'deprecate',
    'deprecates',
    'deprecated',
    'deprecation',
    'compatibility',
    'compatible',
    'version',
    'versions',
  ].includes(keyword);
}

export function impactApiContextMatches(tokens: Set<string>): boolean {
  const apiSubject = [
    'api',
    'apis',
    'endpoint',
    'endpoints',
    'client',
    'clients',
    'contract',
    'contracts',
    'public',
  ].some((token) => tokens.has(token));
  const breakingSignal = [
    'impact',
    'break',
    'breaks',
    'breaking',
    'blast',
    'radius',
    'affect',
    'callers',
    'used',
    'usage',
    'referenced',
    'called',
    'rename',
    'remove',
    'delete',
    'deprecate',
    'deprecates',
    'deprecated',
    'deprecation',
    'change',
    'changes',
    'changing',
    'compatibility',
    'compatible',
    'version',
    'versions',
  ].some((token) => tokens.has(token));
  return apiSubject && breakingSignal;
}

export function impactRollbackContextMatches(keyword: string, tokens: Set<string>): boolean {
  if (['revert', 'rollback', 'undo', 'backout'].includes(keyword)) return true;
  if (['back', 'out'].includes(keyword)) return tokens.has('back') && tokens.has('out');
  if (keyword === 'recover')
    return tokens.has('bad') || tokens.has('deploy') || tokens.has('deployment');
  return false;
}

export function doctorCleanupDeleteContextMatches(
  tokens: Set<string>,
  hasFilePath: boolean,
  hasPackageRemoval: boolean,
): boolean {
  if (hasFilePath || hasPackageRemoval) return false;
  return (
    (tokens.has('safe') || tokens.has('safely') || tokens.has('cleanup') || tokens.has('clean')) &&
    (tokens.has('delete') || tokens.has('remove')) &&
    !impactDeleteContextMatches(tokens)
  );
}

export function doctorCleanupDiscoveryContextMatches(tokens: Set<string>): boolean {
  const cleanupSignal = ['dead', 'unused', 'orphaned', 'cleanup', 'clean'].some((token) =>
    tokens.has(token),
  );
  if (!cleanupSignal) return false;
  return [
    'code',
    'export',
    'exports',
    'delete',
    'remove',
    'find',
    'search',
    'locate',
    'where',
  ].some((token) => tokens.has(token));
}

export function hotspotFileRiskContextMatches(tokens: Set<string>): boolean {
  return [
    'risk',
    'risks',
    'risky',
    'riskiest',
    'dangerous',
    'hotspot',
    'hotspots',
    'complex',
    'complexity',
    'refactor',
    'refactoring',
    'simplify',
    'simplification',
    'tech',
    'debt',
    'duplicate',
    'duplicated',
    'duplication',
    'over',
    'engineered',
    'performance',
    'perf',
    'bottleneck',
    'bottlenecks',
    'optimize',
    'optimise',
    'faster',
    'slow',
  ].some((token) => tokens.has(token));
}

export function hotspotWhereContextMatches(tokens: Set<string>, hasFilePath: boolean): boolean {
  return (
    [
      'focus',
      'risky',
      'riskiest',
      'dangerous',
      'hotspot',
      'hotspots',
      'churn',
      'complexity',
      'complex',
      'refactor',
      'refactoring',
      'simplify',
      'simplification',
      'tech',
      'debt',
      'duplicate',
      'duplicated',
      'duplication',
      'over',
      'engineered',
      'performance',
      'perf',
      'bottleneck',
      'bottlenecks',
      'optimize',
      'optimise',
      'faster',
      'slow',
    ].some((token) => tokens.has(token)) ||
    (!hasFilePath && tokens.has('start') && !localServiceSetupCommandContextMatches(tokens))
  );
}

export function hotspotPerformanceContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('slow') && regressionPerformanceContextMatches(tokens)) return false;
  return [
    'performance',
    'perf',
    'bottleneck',
    'bottlenecks',
    'optimize',
    'optimise',
    'faster',
    'slow',
  ].some((token) => tokens.has(token));
}
