export function repoRunContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('test') || tokens.has('tests')) return false;
  const runAction = ['run', 'start', 'command', 'dev', 'server'].some((token) => tokens.has(token));
  const repoSubject = ['project', 'repo', 'app', 'dev', 'server'].some((token) =>
    tokens.has(token),
  );
  return runAction && repoSubject;
}

export function localServiceSetupCommandContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'fail',
      'failing',
      'failed',
      'failure',
      'failures',
      'error',
      'errors',
      'broken',
      'connection',
      'refused',
      'port',
      'ports',
      'eaddrinuse',
      'permission',
      'denied',
      'enoent',
      'eresolve',
      'peer',
    ].some((token) => tokens.has(token))
  ) {
    return false;
  }
  const action =
    ['run', 'runs', 'start', 'starts', 'command', 'commands', 'setup'].some((token) =>
      tokens.has(token),
    ) ||
    (tokens.has('set') && tokens.has('up'));
  const localSubject = tokens.has('local') || tokens.has('locally') || tokens.has('dev');
  const serviceSubject = ['service', 'services', 'server', 'app'].some((token) =>
    tokens.has(token),
  );
  const dockerComposeSubject = tokens.has('docker') && tokens.has('compose');
  return action && ((localSubject && serviceSubject) || dockerComposeSubject);
}

export function databaseSetupCommandContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'fail',
      'failing',
      'failed',
      'failure',
      'failures',
      'error',
      'errors',
      'broken',
      'connection',
      'refused',
      'port',
      'ports',
      'eaddrinuse',
      'permission',
      'denied',
      'enoent',
      'eresolve',
      'peer',
    ].some((token) => tokens.has(token))
  ) {
    return false;
  }
  if (['where', 'find', 'locate', 'search', 'lookup', 'defined'].some((token) => tokens.has(token)))
    return false;
  const databaseSubject = ['database', 'db', 'migration', 'migrations'].some((token) =>
    tokens.has(token),
  );
  const dataSubject =
    tokens.has('data') && (tokens.has('seed') || tokens.has('seeds') || tokens.has('load'));
  const setupAction = [
    'seed',
    'seeds',
    'reset',
    'resets',
    'migrate',
    'migrates',
    'run',
    'runs',
    'command',
    'load',
    'locally',
  ].some((token) => tokens.has(token));
  return (databaseSubject || dataSubject) && setupAction;
}

export function npmScriptsContextMatches(tokens: Set<string>): boolean {
  const scriptSubject = tokens.has('script') || tokens.has('scripts');
  const lookupSignal = [
    'npm',
    'command',
    'commands',
    'run',
    'runs',
    'start',
    'exist',
    'exists',
    'list',
    'show',
  ].some((token) => tokens.has(token));
  return scriptSubject && lookupSignal;
}

export function packageScriptDiscoveryContextMatches(tokens: Set<string>): boolean {
  const failureSignal = [
    'fail',
    'failing',
    'failed',
    'failure',
    'failures',
    'error',
    'errors',
    'broken',
    'debug',
    'flake',
    'flaky',
    'flakes',
    'slow',
    'slower',
    'rerun',
    'reproduce',
    'reproduces',
    'reproducing',
    'quarantine',
  ].some((token) => tokens.has(token));
  if (failureSignal) return false;

  const scriptSubject = ['script', 'scripts', 'command', 'commands'].some((token) =>
    tokens.has(token),
  );
  const runSignal = ['run', 'runs', 'start'].some((token) => tokens.has(token));
  const scriptTarget = [
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
    'build',
  ].some((token) => tokens.has(token));
  const directScriptTarget = [
    'e2e',
    'storybook',
    'cypress',
    'playwright',
    'eslint',
    'prettier',
    'format',
    'lint',
    'typecheck',
    'typechecking',
    'build',
  ].some((token) => tokens.has(token));
  if (
    (tokens.has('npm') || tokens.has('package')) &&
    (tokens.has('script') || tokens.has('scripts'))
  )
    return true;
  if (directScriptTarget && runSignal && !tokens.has('should')) return true;
  return scriptTarget && scriptSubject;
}

export function repoSetupContextMatches(tokens: Set<string>): boolean {
  return (
    tokens.has('setup') ||
    tokens.has('locally') ||
    tokens.has('install') ||
    (tokens.has('set') && tokens.has('up'))
  );
}

export function repoConfigContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('privacy') || tokens.has('trust') || tokens.has('boundary')) return false;
  if (
    tokens.has('projscan') &&
    ['read', 'upload', 'telemetry', 'write', 'writes'].some((token) => tokens.has(token))
  )
    return false;
  const envSubject = ['env', 'environment', 'environments', 'vars', 'variable', 'variables'].some(
    (token) => tokens.has(token),
  );
  return (
    tokens.has('vars') ||
    tokens.has('variables') ||
    tokens.has('variable') ||
    tokens.has('environment') ||
    tokens.has('environments') ||
    tokens.has('config') ||
    tokens.has('configuration') ||
    (envSubject &&
      ['missing', 'need', 'needed', 'required', 'requires', 'uses', 'repo', 'project', 'app'].some(
        (token) => tokens.has(token),
      ))
  );
}

export function repoOrientationContextMatches(tokens: Set<string>): boolean {
  if (['bug', 'bugs', 'fix', 'issue', 'issues', 'test', 'tests'].some((token) => tokens.has(token)))
    return false;
  const orientationSubject =
    [
      'repo',
      'repository',
      'codebase',
      'service',
      'services',
      'architecture',
      'entrypoint',
      'entrypoints',
    ].some((token) => tokens.has(token)) ||
    (tokens.has('entry') && tokens.has('point')) ||
    (tokens.has('important') && tokens.has('files'));
  const orientationAction = [
    'understand',
    'orient',
    'overview',
    'map',
    'read',
    'summarize',
    'summary',
    'new',
    'onboard',
    'onboarding',
    'start',
    'look',
    'first',
    'tour',
    'walk',
    'through',
    'main',
    'important',
    'where',
    'show',
    'give',
    'help',
    'explain',
  ].some((token) => tokens.has(token));
  if (tokens.has('look') && tokens.has('first')) return true;
  return orientationSubject && orientationAction;
}
