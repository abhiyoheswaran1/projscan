import {
  apiChangePlanningContextMatches,
  databaseChangePlanningContextMatches,
  documentationPlanningContextMatches,
  featurePlacementContextMatches,
} from './intentRouterPlanningSignals.js';
import {
  databaseSetupCommandContextMatches,
  localServiceSetupCommandContextMatches,
  npmScriptsContextMatches,
  packageScriptDiscoveryContextMatches,
  repoConfigContextMatches,
  repoOrientationContextMatches,
  repoRunContextMatches,
  repoSetupContextMatches,
} from './intentRouterRepoSignals.js';
import { verificationPlanningContextMatches } from './intentRouterVerificationSignals.js';

export function understandKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (
    [
      'api',
      'apis',
      'deprecate',
      'deprecates',
      'deprecated',
      'deprecation',
      'compatibility',
      'compatible',
    ].includes(keyword)
  ) {
    return true;
  }
  if (
    [
      'repo',
      'codebase',
      'service',
      'services',
      'architecture',
      'main',
      'entrypoint',
      'entrypoints',
      'entry',
      'point',
      'important',
      'look',
      'first',
      'tour',
      'walk',
      'through',
      'new',
      'onboard',
      'onboarding',
    ].includes(keyword)
  ) {
    if (keyword === 'repo' && (tokens.has('summarize') || tokens.has('summary'))) return false;
    return repoOrientationContextMatches(tokens);
  }
  if (
    ['run', 'runs', 'project', 'command', 'commands', 'dev', 'server', 'start', 'app'].includes(
      keyword,
    )
  ) {
    return (
      packageScriptDiscoveryContextMatches(tokens) ||
      verificationPlanningContextMatches(tokens) ||
      databaseSetupCommandContextMatches(tokens) ||
      localServiceSetupCommandContextMatches(tokens) ||
      repoRunContextMatches(tokens) ||
      repoOrientationContextMatches(tokens)
    );
  }
  if (['local', 'locally', 'docker', 'compose'].includes(keyword))
    return localServiceSetupCommandContextMatches(tokens) || repoSetupContextMatches(tokens);
  if (['npm', 'script', 'scripts'].includes(keyword)) {
    return npmScriptsContextMatches(tokens) || packageScriptDiscoveryContextMatches(tokens);
  }
  if (
    [
      'test',
      'tests',
      'e2e',
      'unit',
      'integration',
      'storybook',
      'cypress',
      'playwright',
      'eslint',
      'prettier',
      'format',
      'lint',
      'typecheck',
      'typechecking',
    ].includes(keyword)
  ) {
    return (
      packageScriptDiscoveryContextMatches(tokens) || verificationPlanningContextMatches(tokens)
    );
  }
  if (['verify', 'verification', 'proof', 'prove', 'checks'].includes(keyword)) {
    return verificationPlanningContextMatches(tokens);
  }
  if (['setup', 'set', 'locally', 'install'].includes(keyword)) {
    return repoSetupContextMatches(tokens);
  }
  if (
    [
      'env',
      'environment',
      'environments',
      'vars',
      'variable',
      'variables',
      'missing',
      'required',
      'config',
      'configuration',
    ].includes(keyword)
  ) {
    return repoConfigContextMatches(tokens);
  }
  if (['seed', 'seeds', 'reset', 'resets', 'migrate', 'migrates'].includes(keyword)) {
    return databaseSetupCommandContextMatches(tokens);
  }
  if (
    [
      'feature',
      'endpoint',
      'button',
      'put',
      'need',
      'change',
      'files',
      'add',
      'implement',
      'build',
      'create',
      'wire',
      'route',
      'component',
      'page',
      'screen',
      'view',
      'webhook',
      'auth',
      'login',
      'support',
      'checkout',
      'search',
      'password',
      'reset',
      'invite',
      'onboarding',
      'refund',
      'subscription',
      'doc',
      'docs',
      'document',
      'documentation',
      'readme',
      'examples',
      'example',
      'migration',
      'migrations',
      'database',
      'db',
      'schema',
      'table',
      'column',
      'guide',
      'update',
      'updating',
    ].includes(keyword)
  ) {
    if (keyword === 'add' && tokens.has('where')) return false;
    if (
      [
        'doc',
        'docs',
        'document',
        'documentation',
        'readme',
        'examples',
        'example',
        'guide',
        'update',
        'updating',
      ].includes(keyword) &&
      !documentationPlanningContextMatches(tokens)
    )
      return false;
    if (
      ['migration', 'migrations', 'database', 'db'].includes(keyword) &&
      databaseSetupCommandContextMatches(tokens)
    )
      return true;
    if (
      ['migration', 'migrations', 'database', 'db', 'schema', 'table', 'column'].includes(
        keyword,
      ) &&
      !databaseChangePlanningContextMatches(tokens)
    )
      return false;
    if (keyword === 'change' && apiChangePlanningContextMatches(tokens)) return true;
    return featurePlacementContextMatches(tokens);
  }
  return true;
}
