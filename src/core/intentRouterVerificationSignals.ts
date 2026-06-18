import { pythonUpgradeCoverageContextMatches } from './intentRouterDependencySignals.js';
import {
  regressionFailureContextMatches,
  regressionFlakeContextMatches,
  regressionPerformanceContextMatches,
} from './intentRouterRegressionSignals.js';
import { packageScriptDiscoveryContextMatches } from './intentRouterRepoSignals.js';

export function verificationPlanningContextMatches(tokens: Set<string>): boolean {
  if (
    ['smoke', 'focused', 'full', 'regression'].some((token) => tokens.has(token)) ||
    regressionFailureContextMatches(tokens) ||
    regressionPerformanceContextMatches(tokens) ||
    regressionFlakeContextMatches(tokens) ||
    testCoverageLookupContextMatches(tokens) ||
    coverageGapContextMatches(tokens) ||
    packageScriptDiscoveryContextMatches(tokens)
  ) {
    return false;
  }
  const testSubject = [
    'test',
    'tests',
    'spec',
    'specs',
    'e2e',
    'unit',
    'integration',
    'lint',
    'typecheck',
    'typechecking',
    'build',
  ].some((token) => tokens.has(token));
  const proofSignal = ['verify', 'verification', 'proof', 'prove', 'checks'].some((token) =>
    tokens.has(token),
  );
  const runSignal = ['run', 'rerun', 'execute'].some((token) => tokens.has(token));
  const gateSignal = [
    'before',
    'push',
    'pushing',
    'commit',
    'committing',
    'review',
    'merge',
    'pr',
  ].some((token) => tokens.has(token));
  const shouldSignal = ['should', 'need', 'needs', 'must'].some((token) => tokens.has(token));
  const querySignal = ['which', 'what'].some((token) => tokens.has(token));
  const changeSignal = ['change', 'changes', 'diff', 'branch'].some((token) => tokens.has(token));
  return (
    (testSubject &&
      (shouldSignal ||
        gateSignal ||
        proofSignal ||
        (runSignal && (querySignal || changeSignal)))) ||
    (proofSignal && (runSignal || gateSignal || testSubject))
  );
}

export function searchTestLocationContextMatches(
  tokens: Set<string>,
  hasFilePath: boolean,
): boolean {
  if (testCoverageLookupContextMatches(tokens)) return true;
  if (!['where', 'find', 'locate', 'search', 'lookup'].some((token) => tokens.has(token)))
    return false;
  if (
    [
      'run',
      'rerun',
      'write',
      'add',
      'generate',
      'plan',
      'case',
      'cases',
      'cover',
      'coverage',
      'edge',
    ].some((token) => tokens.has(token))
  ) {
    return false;
  }
  return hasFilePath || ['test', 'tests', 'spec', 'specs'].some((token) => tokens.has(token));
}

export function testCoverageLookupContextMatches(tokens: Set<string>): boolean {
  if (
    ['run', 'rerun', 'write', 'add', 'generate', 'plan', 'case', 'cases', 'edge', 'should'].some(
      (token) => tokens.has(token),
    )
  )
    return false;
  const testSubject = ['test', 'tests', 'spec', 'specs'].some((token) => tokens.has(token));
  const coverSignal = ['cover', 'covers', 'covering'].some((token) => tokens.has(token));
  const lookupSignal = ['which', 'what', 'where', 'find', 'locate', 'search', 'lookup'].some(
    (token) => tokens.has(token),
  );
  return testSubject && coverSignal && (lookupSignal || tokens.size >= 3);
}

export function coverageKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (pythonUpgradeCoverageContextMatches(tokens)) return false;
  if (['coverage', 'scariest', 'untested', 'uncovered', 'gap', 'gaps'].includes(keyword))
    return true;
  if (['test', 'tests'].includes(keyword)) return coverageGapContextMatches(tokens);
  if (['file', 'files', 'no', 'missing', 'without'].includes(keyword))
    return missingTestCoverageContextMatches(tokens);
  return false;
}

export function coverageGapContextMatches(tokens: Set<string>): boolean {
  if (pythonUpgradeCoverageContextMatches(tokens)) return false;
  if (
    ['coverage', 'scariest', 'untested', 'uncovered', 'gap', 'gaps'].some((token) =>
      tokens.has(token),
    )
  )
    return true;
  return missingTestCoverageContextMatches(tokens);
}

export function missingTestCoverageContextMatches(tokens: Set<string>): boolean {
  const testSubject = tokens.has('test') || tokens.has('tests');
  const fileSubject = tokens.has('file') || tokens.has('files');
  const missingSignal = ['no', 'missing', 'without'].some((token) => tokens.has(token));
  return testSubject && (fileSubject || tokens.has('code')) && missingSignal;
}

export function searchCodeLocationContextMatches(tokens: Set<string>): boolean {
  if (['run', 'rerun', 'test', 'tests', 'spec', 'specs'].some((token) => tokens.has(token)))
    return false;
  const locator = ['where', 'find', 'locate', 'search', 'lookup', 'which'].some((token) =>
    tokens.has(token),
  );
  const codeSubject = ['code', 'file', 'files', 'logic', 'handler', 'middleware', 'loader'].some(
    (token) => tokens.has(token),
  );
  const codeAction = [
    'handles',
    'handled',
    'contains',
    'implemented',
    'configured',
    'created',
    'loaded',
    'parse',
    'parses',
  ].some((token) => tokens.has(token));
  return locator || (codeSubject && codeAction);
}

export function testRunContextMatches(tokens: Set<string>): boolean {
  return tokens.has('test') || tokens.has('tests');
}
