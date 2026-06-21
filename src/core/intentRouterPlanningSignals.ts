export function featurePlacementContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('test') || tokens.has('tests')) return false;
  if (documentationPlanningContextMatches(tokens)) return true;
  if (databaseChangePlanningContextMatches(tokens)) return true;
  if (apiChangePlanningContextMatches(tokens)) return true;
  if (stateManagementPlanningContextMatches(tokens)) return true;
  if (dataAccessPlanningContextMatches(tokens)) return true;
  if (navigationLayoutPlanningContextMatches(tokens)) return true;
  if (styleSystemPlanningContextMatches(tokens)) return true;
  const placementSubject = ['feature', 'endpoint', 'button'].some((token) => tokens.has(token));
  if (placementSubject && ['where', 'put', 'add'].some((token) => tokens.has(token))) return true;
  if (
    tokens.has('files') &&
    (tokens.has('change') || tokens.has('modify'))
  )
    return true;
  if (tokens.has('where') && tokens.has('add')) return true;
  const kickoffAction = ['add', 'implement', 'build', 'create', 'wire'].some((token) =>
    tokens.has(token),
  );
  const kickoffSubject = [
    'feature',
    'endpoint',
    'button',
    'api',
    'apis',
    'route',
    'component',
    'page',
    'screen',
    'view',
    'webhook',
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
  ].some((token) => tokens.has(token));
  return kickoffAction && kickoffSubject;
}

export function domainWorkflowPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = [
    'add',
    'create',
    'implement',
    'build',
    'plan',
    'should',
    'todo',
    'next',
  ].some((token) => tokens.has(token));
  if (!planningAction) return false;
  return (
    (tokens.has('password') && tokens.has('reset')) ||
    tokens.has('invite') ||
    tokens.has('invites') ||
    tokens.has('onboarding') ||
    tokens.has('refund') ||
    (tokens.has('subscription') && tokens.has('renewal'))
  );
}

export function stateManagementPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = [
    'add',
    'create',
    'implement',
    'build',
    'plan',
    'should',
    'todo',
    'next',
  ].some((token) => tokens.has(token));
  if (!planningAction) return false;
  return (
    [
      'redux',
      'zustand',
      'jotai',
      'recoil',
      'store',
      'stores',
      'slice',
      'slices',
      'selector',
      'selectors',
      'context',
      'provider',
      'providers',
      'hook',
      'hooks',
    ].some((token) => tokens.has(token)) ||
    (tokens.has('react') && tokens.has('query'))
  );
}

export function dataAccessPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = [
    'add',
    'create',
    'implement',
    'build',
    'plan',
    'should',
    'todo',
    'next',
  ].some((token) => tokens.has(token));
  if (!planningAction) return false;
  return (
    [
      'prisma',
      'drizzle',
      'typeorm',
      'sequelize',
      'model',
      'models',
      'entity',
      'entities',
      'repository',
      'repositories',
      'dao',
      'daos',
    ].some((token) => tokens.has(token)) ||
    (tokens.has('sql') && (tokens.has('query') || tokens.has('queries')))
  );
}

function navigationLayoutPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo'].some(
    (token) => tokens.has(token),
  );
  if (!planningAction) return false;
  return (
    [
      'sidebar',
      'nav',
      'navigation',
      'menu',
      'breadcrumb',
      'breadcrumbs',
      'layout',
      'title',
      'metadata',
    ].some((token) => tokens.has(token)) ||
    (tokens.has('next') && tokens.has('js'))
  );
}

function styleSystemPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo'].some(
    (token) => tokens.has(token),
  );
  if (!planningAction) return false;
  return (
    (tokens.has('design') && (tokens.has('token') || tokens.has('tokens'))) ||
    tokens.has('tailwind') ||
    tokens.has('css') ||
    (tokens.has('dark') && tokens.has('mode')) ||
    tokens.has('breakpoint') ||
    tokens.has('breakpoints') ||
    tokens.has('theme') ||
    tokens.has('themes') ||
    tokens.has('style') ||
    tokens.has('styles')
  );
}

export function documentationPlanningContextMatches(tokens: Set<string>): boolean {
  if (['find', 'where', 'locate', 'search', 'lookup'].some((token) => tokens.has(token)))
    return false;
  const docsSubject = [
    'doc',
    'docs',
    'document',
    'documentation',
    'readme',
    'examples',
    'example',
    'migration',
    'guide',
  ].some((token) => tokens.has(token));
  if (!docsSubject) return false;
  return [
    'change',
    'changes',
    'update',
    'updating',
    'need',
    'needs',
    'write',
    'generate',
    'feature',
    'api',
    'apis',
  ].some((token) => tokens.has(token));
}

export function databaseChangePlanningContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('test') || tokens.has('tests')) return false;
  if (
    [
      'impact',
      'breaks',
      'break',
      'blast',
      'radius',
      'affect',
      'used',
      'usage',
      'referenced',
      'called',
      'drop',
      'delete',
      'remove',
      'rollback',
      'revert',
    ].some((token) => tokens.has(token))
  )
    return false;
  const databaseSubject = [
    'migration',
    'migrations',
    'database',
    'db',
    'schema',
    'table',
    'column',
  ].some((token) => tokens.has(token));
  if (!databaseSubject) return false;
  return [
    'where',
    'put',
    'add',
    'change',
    'need',
    'needs',
    'plan',
    'deploy',
    'zero',
    'downtime',
  ].some((token) => tokens.has(token));
}

export function apiChangePlanningContextMatches(tokens: Set<string>): boolean {
  const apiSubject = [
    'api',
    'apis',
    'endpoint',
    'endpoints',
    'contract',
    'contracts',
    'public',
    'client',
    'clients',
  ].some((token) => tokens.has(token));
  if (!apiSubject) return false;
  return [
    'change',
    'changes',
    'changing',
    'deprecate',
    'deprecates',
    'deprecated',
    'deprecation',
    'break',
    'breaks',
    'breaking',
    'compatibility',
    'compatible',
    'version',
    'versions',
  ].some((token) => tokens.has(token));
}
