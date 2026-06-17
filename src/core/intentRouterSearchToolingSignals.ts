const BLOCKED_ACTION_KEYWORDS = [
  'add',
  'create',
  'implement',
  'build',
  'plan',
  'should',
  'todo',
  'update',
  'upgrade',
  'bump',
  'remove',
  'drop',
  'uninstall',
];

const FAILURE_CONTEXT_KEYWORDS = [
  'why',
  'failing',
  'failed',
  'failure',
  'failures',
  'broken',
  'error',
  'errors',
  'runtime',
  'production',
  'prod',
  'outage',
  'incident',
];

const LOOKUP_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];

const CONFIG_SIGNAL_KEYWORDS = [
  'config',
  'configuration',
  'configured',
  'file',
  'files',
  'defined',
  'define',
  'defines',
];

const CONFIG_TOOL_KEYWORDS = ['vite', 'vitest', 'jest', 'babel', 'webpack'];
const TYPESCRIPT_CONFIG_KEYWORDS = [
  'config',
  'configuration',
  'path',
  'paths',
  'alias',
  'aliases',
  'strict',
];
const PACKAGE_MANAGER_KEYWORDS = ['pnpm', 'yarn', 'npm'];
const WORKSPACE_FILE_KEYWORDS = [
  'workspace',
  'workspaces',
  'lockfile',
  'lockfiles',
  'package',
  'manager',
];

export function searchToolingConfigContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, BLOCKED_ACTION_KEYWORDS)) return false;
  if (hasAnyToken(tokens, FAILURE_CONTEXT_KEYWORDS)) return false;

  const lookup = hasLookup(tokens);
  const configSignal = hasConfigSignal(tokens);
  if (!hasToolingConfigSubject(tokens, lookup, configSignal)) return false;

  return lookup || configSignal || tokens.size >= 3;
}

function hasToolingConfigSubject(
  tokens: Set<string>,
  lookup: boolean,
  configSignal: boolean,
): boolean {
  return (
    hasConfigToolSubject(tokens, lookup, configSignal) ||
    hasTsconfigSubject(tokens) ||
    hasPathAliasSubject(tokens) ||
    hasPackageManagerSubject(tokens) ||
    hasWorkspaceFileSubject(tokens)
  );
}

function hasConfigToolSubject(
  tokens: Set<string>,
  lookup: boolean,
  configSignal: boolean,
): boolean {
  return hasAnyToken(tokens, CONFIG_TOOL_KEYWORDS) && (configSignal || lookup);
}

function hasTsconfigSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('tsconfig') ||
    (tokens.has('typescript') && hasAnyToken(tokens, TYPESCRIPT_CONFIG_KEYWORDS))
  );
}

function hasPathAliasSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, ['path', 'paths']) &&
    hasAnyToken(tokens, ['alias', 'aliases']) &&
    hasAnyToken(tokens, ['tsconfig', 'typescript', 'config'])
  );
}

function hasPackageManagerSubject(tokens: Set<string>): boolean {
  return tokens.has('package') && tokens.has('manager');
}

function hasWorkspaceFileSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, PACKAGE_MANAGER_KEYWORDS) && hasAnyToken(tokens, WORKSPACE_FILE_KEYWORDS)
  );
}

function hasLookup(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOOKUP_KEYWORDS);
}

function hasConfigSignal(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, CONFIG_SIGNAL_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
