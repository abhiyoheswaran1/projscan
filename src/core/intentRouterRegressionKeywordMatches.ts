import {
  harnessProofContextMatches,
  proofCommandContextMatches,
  regressionBenchmarkContextMatches,
  regressionCiPlatformContextMatches,
  regressionFailureContextMatches,
  regressionFlakeContextMatches,
  regressionLocalSetupContextMatches,
  regressionPerformanceContextMatches,
} from './intentRouterRegressionSignals.js';
import { packageScriptDiscoveryContextMatches } from './intentRouterRepoSignals.js';
import { searchApiContractContextMatches } from './intentRouterSearchApiSignals.js';
import { searchCommunicationArtifactContextMatches } from './intentRouterSearchCommunicationSignals.js';
import { searchDataAccessContextMatches } from './intentRouterSearchDataSignals.js';
import { searchDomainWorkflowContextMatches } from './intentRouterSearchDomainSignals.js';
import { searchInfraArtifactContextMatches } from './intentRouterSearchInfraSignals.js';
import { searchIntegrationContextMatches } from './intentRouterSearchIntegrationSignals.js';
import { searchQuotedDebugTextContextMatches } from './intentRouterSearchLookupSignals.js';
import { searchNavigationLayoutContextMatches } from './intentRouterSearchNavigationSignals.js';
import { searchFrontendPageRouteContextMatches } from './intentRouterSearchPageSignals.js';
import { searchReliabilityContextMatches } from './intentRouterSearchReliabilitySignals.js';
import { searchStateManagementContextMatches } from './intentRouterSearchStateSignals.js';
import { searchStyleSystemContextMatches } from './intentRouterSearchStyleSignals.js';
import { searchUiInteractionContextMatches } from './intentRouterSearchUiSignals.js';
import {
  coverageGapContextMatches,
  testCoverageLookupContextMatches,
  testRunContextMatches,
  verificationPlanningContextMatches,
} from './intentRouterVerificationSignals.js';

export function regressionKeywordMatches(
  keyword: string,
  tokens: Set<string>,
  hasQuotedText: boolean,
): boolean {
  if (keyword === 'full' && !fullRegressionContextMatches(tokens)) return false;
  if (
    [
      'github',
      'action',
      'actions',
      'workflow',
      'workflows',
      'pipeline',
      'pipelines',
      'job',
      'jobs',
    ].includes(keyword) &&
    !regressionCiPlatformContextMatches(tokens)
  )
    return false;
  if (searchQuotedDebugTextContextMatches(tokens, hasQuotedText)) return false;
  if (searchReliabilityContextMatches(tokens)) return false;
  if (searchUiInteractionContextMatches(tokens)) return false;
  if (searchIntegrationContextMatches(tokens)) return false;
  if (searchApiContractContextMatches(tokens)) return false;
  if (searchInfraArtifactContextMatches(tokens)) return false;
  if (searchDomainWorkflowContextMatches(tokens)) return false;
  if (searchCommunicationArtifactContextMatches(tokens)) return false;
  if (searchStateManagementContextMatches(tokens)) return false;
  if (searchDataAccessContextMatches(tokens)) return false;
  if (searchNavigationLayoutContextMatches(tokens)) return false;
  if (searchFrontendPageRouteContextMatches(tokens)) return false;
  if (searchStyleSystemContextMatches(tokens)) return false;
  if (verificationPlanningContextMatches(tokens) && !harnessProofContextMatches(tokens))
    return false;
  if (
    ['agentflight', 'agentloop', 'agentloopkit', 'harness'].includes(keyword) &&
    !harnessProofContextMatches(tokens)
  )
    return false;
  if (packageScriptDiscoveryContextMatches(tokens)) return false;
  if (
    [
      'port',
      'ports',
      'eaddrinuse',
      'listen',
      'address',
      'permission',
      'denied',
      'enoent',
      'eresolve',
      'peer',
    ].includes(keyword) &&
    !regressionLocalSetupContextMatches(tokens)
  )
    return false;
  if (
    [
      'build',
      'builds',
      'lint',
      'typecheck',
      'typechecking',
      'install',
      'debug',
      'stack',
      'trace',
      'error',
      'errors',
      'failure',
      'failures',
      'production',
      'prod',
      'down',
      'outage',
      'incident',
      'triage',
      'runtime',
      'crash',
      'crashes',
      'crashing',
      'connection',
      'refused',
      'root',
      'cause',
      'returning',
      'returns',
      'log',
      'logs',
      '500',
      '502',
      '503',
      '504',
      '404',
      '403',
      '401',
    ].includes(keyword) &&
    !regressionFailureContextMatches(tokens) &&
    !regressionPerformanceContextMatches(tokens)
  )
    return false;
  if (
    ['test', 'tests'].includes(keyword) &&
    (testCoverageLookupContextMatches(tokens) || coverageGapContextMatches(tokens))
  )
    return false;
  if (
    ['run', 'rerun'].includes(keyword) &&
    !testRunContextMatches(tokens) &&
    !harnessProofContextMatches(tokens)
  )
    return false;
  if (
    ['commands', 'command', 'works'].includes(keyword) &&
    !proofCommandContextMatches(tokens) &&
    !regressionBenchmarkContextMatches(tokens) &&
    !regressionFlakeContextMatches(tokens)
  )
    return false;
  if (
    ['slow', 'slower', 'speed', 'speedup', 'faster', 'benchmark', 'benchmarks'].includes(keyword) &&
    !regressionPerformanceContextMatches(tokens)
  )
    return false;
  if (
    [
      'reproduce',
      'reproduces',
      'reproducing',
      'flake',
      'flaky',
      'flakes',
      'intermittent',
      'intermittently',
      'nondeterministic',
      'nondeterminism',
      'race',
      'condition',
      'stabilize',
      'stabilise',
      'quarantine',
    ].includes(keyword) &&
    !regressionFlakeContextMatches(tokens)
  )
    return false;
  return true;
}

function fullRegressionContextMatches(tokens: Set<string>): boolean {
  return [
    'regression',
    'verification',
    'verify',
    'test',
    'tests',
    'suite',
    'suites',
    'run',
    'rerun',
    'check',
    'checks',
    'proof',
    'prove',
  ].some((token) => tokens.has(token));
}
