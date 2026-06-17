const IMPLEMENTATION_ACTION_KEYWORDS = [
  'add',
  'create',
  'implement',
  'build',
  'plan',
  'should',
  'todo',
];

const FAILURE_CONTEXT_KEYWORDS = [
  'why',
  'returning',
  'returns',
  'failing',
  'failed',
  'failure',
  'failures',
  'production',
  'prod',
  'down',
  'outage',
  'incident',
  'runtime',
  'crash',
  'crashes',
  'crashing',
];

const LOCATOR_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];

const RENDER_SIGNAL_KEYWORDS = [
  'render',
  'renders',
  'rendered',
  'handled',
  'defined',
  'located',
  'lives',
];

const NAMED_PAGE_KEYWORDS = ['billing', 'settings', 'checkout', 'dashboard', 'admin'];

export function searchFrontendPageRouteContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (hasAnyToken(tokens, FAILURE_CONTEXT_KEYWORDS)) return false;

  const locator = hasLocator(tokens);
  const renderSignal = hasRenderSignal(tokens);
  if (!hasFrontendPageRouteSubject(tokens, renderSignal)) return false;

  return locator || renderSignal || tokens.size >= 3;
}

function hasFrontendPageRouteSubject(tokens: Set<string>, renderSignal: boolean): boolean {
  return (
    hasPageSubject(tokens, renderSignal) ||
    hasRouteSegmentSubject(tokens) ||
    hasNotFoundSubject(tokens) ||
    hasStatusPageSubject(tokens)
  );
}

function hasPageSubject(tokens: Set<string>, renderSignal: boolean): boolean {
  return (
    tokens.has('page') &&
    (renderSignal ||
      hasAnyToken(tokens, NAMED_PAGE_KEYWORDS) ||
      hasNotFoundTokens(tokens) ||
      tokens.has('404'))
  );
}

function hasRouteSegmentSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, ['route', 'routes']) && hasAnyToken(tokens, ['segment', 'segments'])
  );
}

function hasNotFoundSubject(tokens: Set<string>): boolean {
  return tokens.has('page') && hasNotFoundTokens(tokens);
}

function hasStatusPageSubject(tokens: Set<string>): boolean {
  return tokens.has('page') && tokens.has('404');
}

function hasNotFoundTokens(tokens: Set<string>): boolean {
  return tokens.has('not') && tokens.has('found');
}

function hasLocator(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOCATOR_KEYWORDS);
}

function hasRenderSignal(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, RENDER_SIGNAL_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
