const IMPLEMENTATION_ACTION_KEYWORDS = [
  'add',
  'create',
  'implement',
  'build',
  'plan',
  'should',
  'todo',
  'next',
];

const SENSITIVE_CONTEXT_KEYWORDS = [
  'leak',
  'leaks',
  'leaking',
  'logged',
  'logging',
  'retention',
  'pii',
  'gdpr',
  'security',
  'secret',
  'secrets',
  'token',
  'tokens',
  'password',
  'customer',
  'personal',
];

const LOCATOR_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];
const FRAMEWORK_KEYWORDS = ['redux', 'zustand', 'jotai', 'recoil'];
const STORE_KEYWORDS = ['store', 'stores', 'stored'];
const FRAMEWORK_STORE_KEYWORDS = ['store', 'stores', 'slice', 'slices', 'selector', 'selectors'];
const CONTEXT_PROVIDER_KEYWORDS = [
  'provider',
  'providers',
  'supplies',
  'supplied',
  'provides',
  'provided',
];
const HOOK_QUERY_KEYWORDS = [
  'fetch',
  'fetches',
  'fetched',
  'query',
  'queries',
  'mutation',
  'mutations',
];
const STATE_ACTION_KEYWORDS = [
  'stored',
  'fetch',
  'fetches',
  'fetched',
  'supplies',
  'supplied',
  'provides',
  'provided',
];

export function searchStateManagementContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (hasAnyToken(tokens, SENSITIVE_CONTEXT_KEYWORDS)) return false;

  const locator = hasLocator(tokens);
  const frameworkSubject = hasFrameworkSubject(tokens);
  if (!hasStateManagementSubject(tokens, frameworkSubject)) return false;

  return locator || hasAnyToken(tokens, STATE_ACTION_KEYWORDS) || tokens.size >= 3;
}

function hasStateManagementSubject(tokens: Set<string>, frameworkSubject: boolean): boolean {
  return (
    hasStoreSubject(tokens, frameworkSubject) ||
    hasSliceSubject(tokens, frameworkSubject) ||
    hasSelectorSubject(tokens, frameworkSubject) ||
    hasContextSubject(tokens) ||
    hasHookSubject(tokens) ||
    hasReactQuerySubject(tokens)
  );
}

function hasStoreSubject(tokens: Set<string>, frameworkSubject: boolean): boolean {
  return (
    (tokens.has('state') && hasAnyToken(tokens, STORE_KEYWORDS)) ||
    (frameworkSubject && hasAnyToken(tokens, FRAMEWORK_STORE_KEYWORDS))
  );
}

function hasSliceSubject(tokens: Set<string>, frameworkSubject: boolean): boolean {
  return frameworkSubject && hasAnyToken(tokens, ['slice', 'slices']);
}

function hasSelectorSubject(tokens: Set<string>, frameworkSubject: boolean): boolean {
  return frameworkSubject && hasAnyToken(tokens, ['selector', 'selectors']);
}

function hasContextSubject(tokens: Set<string>): boolean {
  return tokens.has('context') && hasAnyToken(tokens, CONTEXT_PROVIDER_KEYWORDS);
}

function hasHookSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['hook', 'hooks']) && hasAnyToken(tokens, HOOK_QUERY_KEYWORDS);
}

function hasReactQuerySubject(tokens: Set<string>): boolean {
  return tokens.has('react') && tokens.has('query') && hasAnyToken(tokens, HOOK_QUERY_KEYWORDS);
}

function hasFrameworkSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, FRAMEWORK_KEYWORDS);
}

function hasLocator(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOCATOR_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
