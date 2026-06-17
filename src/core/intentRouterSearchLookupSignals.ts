export function searchRouteHandlerContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'should',
      'add',
      'put',
      'new',
      'need',
      'needs',
      'change',
      'implement',
      'build',
      'create',
      'wire',
    ].some((token) => tokens.has(token))
  )
    return false;
  const routeSubject = [
    'api',
    'apis',
    'route',
    'routes',
    'endpoint',
    'endpoints',
    'login',
    'checkout',
    'webhook',
  ].some((token) => tokens.has(token));
  if (!routeSubject) return false;
  const handlerSignal = ['handler', 'handles', 'handled', 'implemented', 'defined'].some((token) =>
    tokens.has(token),
  );
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup'].some((token) =>
    tokens.has(token),
  );
  return (
    handlerSignal ||
    (locator &&
      (tokens.has('handler') ||
        tokens.has('route') ||
        tokens.has('endpoint') ||
        tokens.has('endpoints')))
  );
}

export function searchFeatureFlagContextMatches(tokens: Set<string>): boolean {
  const flagSubject =
    tokens.has('flag') || tokens.has('flags') || (tokens.has('feature') && tokens.has('flags'));
  if (!flagSubject) return false;
  return [
    'where',
    'which',
    'find',
    'locate',
    'search',
    'lookup',
    'exist',
    'exists',
    'configured',
    'loaded',
  ].some((token) => tokens.has(token));
}

export function searchEnvLookupContextMatches(
  tokens: Set<string>,
  hasEnvVar: boolean,
): boolean {
  if (hasEnvVar) {
    return ['where', 'find', 'locate', 'search', 'lookup', 'used', 'referenced', 'process'].some(
      (token) => tokens.has(token),
    );
  }
  const envSubject = ['env', 'environment', 'var', 'vars', 'variable', 'variables'].some((token) =>
    tokens.has(token),
  );
  if (!envSubject) return false;
  if (
    [
      'need',
      'needs',
      'required',
      'requires',
      'missing',
      'contract',
      'contracts',
      'repo',
      'project',
    ].some((token) => tokens.has(token))
  )
    return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'controls',
    'control',
    'used',
    'uses',
  ].some((token) => tokens.has(token));
}

export function searchQuotedDebugTextContextMatches(
  tokens: Set<string>,
  hasQuotedText: boolean,
): boolean {
  if (!hasQuotedText) return false;
  const debugSubject = [
    'error',
    'errors',
    'message',
    'messages',
    'throw',
    'throws',
    'thrown',
    'log',
    'logs',
    'logged',
    'logging',
  ].some((token) => tokens.has(token));
  const locator = ['where', 'find', 'locate', 'search', 'lookup'].some((token) =>
    tokens.has(token),
  );
  return debugSubject || locator;
}

export function searchObservabilityContextMatches(tokens: Set<string>): boolean {
  if (['privacy', 'trust', 'upload', 'projscan'].some((token) => tokens.has(token))) return false;
  const observabilitySubject = [
    'metric',
    'metrics',
    'prometheus',
    'analytics',
    'event',
    'events',
    'alert',
    'alerts',
    'sentry',
    'datadog',
    'dashboard',
    'dashboards',
  ].some((token) => tokens.has(token));
  const logSubject =
    (tokens.has('log') || tokens.has('logs')) &&
    ['check', 'where', 'which', 'what', 'find', 'locate', 'search', 'lookup'].some((token) =>
      tokens.has(token),
    );
  if (!observabilitySubject && !logSubject) return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'check',
      'configured',
      'initialize',
      'initialise',
      'init',
      'emit',
      'emits',
      'emitted',
      'send',
      'sends',
      'handled',
      'code',
    ].some((token) => tokens.has(token)) || tokens.size >= 2
  );
}

export function searchAuthorizationContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'fail',
      'failing',
      'failed',
      'failure',
      'failures',
      'error',
      'errors',
      'returning',
      'returns',
      'runtime',
      'incident',
      'crash',
      'crashes',
      'crashing',
      'outage',
      'denied',
      '500',
      '502',
      '503',
      '504',
      '404',
      '403',
      '401',
    ].some((token) => tokens.has(token))
  )
    return false;
  const subject = [
    'permission',
    'permissions',
    'role',
    'roles',
    'access',
    'admin',
    'guard',
    'guards',
    'authorization',
    'authorize',
    'authorized',
    'policy',
    'policies',
    'rbac',
    'login',
  ].some((token) => tokens.has(token));
  if (!subject) return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'checked',
      'configured',
      'defined',
      'require',
      'requires',
      'required',
      'access',
    ].some((token) => tokens.has(token)) || tokens.size >= 3
  );
}

export function searchConfigLookupContextMatches(tokens: Set<string>): boolean {
  const configSubject = tokens.has('config') || tokens.has('configuration');
  if (!configSubject) return false;
  if (
    [
      'need',
      'needs',
      'required',
      'requires',
      'missing',
      'contract',
      'contracts',
      'env',
      'environment',
      'vars',
      'variables',
    ].some((token) => tokens.has(token))
  )
    return false;
  const lookup = ['where', 'which', 'find', 'locate', 'search', 'lookup', 'show'].some((token) =>
    tokens.has(token),
  );
  const configDefinition =
    (tokens.has('file') || tokens.has('files')) &&
    ['define', 'defines', 'alias', 'aliases', 'configured', 'configures'].some((token) =>
      tokens.has(token),
    );
  return lookup || configDefinition;
}

export function searchMigrationLookupContextMatches(tokens: Set<string>): boolean {
  const migrationSubject = tokens.has('migration') || tokens.has('migrations');
  if (!migrationSubject) return false;
  if (
    ['should', 'put', 'add', 'change', 'need', 'needs', 'plan', 'deploy', 'zero', 'downtime'].some(
      (token) => tokens.has(token),
    )
  )
    return false;
  if (
    [
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
    ].some((token) => tokens.has(token))
  )
    return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'show',
    'exist',
    'exists',
    'ran',
    'file',
    'files',
  ].some((token) => tokens.has(token));
}

export function searchGeneratedContextMatches(tokens: Set<string>): boolean {
  if (!tokens.has('generated')) return false;
  if (
    ['write', 'create', 'generate', 'regenerate', 'build', 'emit'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'show',
    'is',
    'code',
    'file',
    'files',
  ].some((token) => tokens.has(token));
}

export function searchDocumentationContextMatches(tokens: Set<string>): boolean {
  const locator = ['where', 'find', 'locate', 'search', 'lookup'].some((token) =>
    tokens.has(token),
  );
  const docsSubject = [
    'doc',
    'docs',
    'document',
    'documentation',
    'documented',
    'readme',
    'examples',
    'example',
    'guide',
  ].some((token) => tokens.has(token));
  return locator && docsSubject;
}
