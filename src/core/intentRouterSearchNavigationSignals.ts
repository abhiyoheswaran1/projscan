const IMPLEMENTATION_ACTION_KEYWORDS = [
  'add',
  'create',
  'implement',
  'build',
  'plan',
  'should',
  'todo',
];

const LOCATOR_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];
const NAVIGATION_KEYWORDS = ['sidebar', 'nav', 'navigation', 'menu'];
const NAVIGATION_CONTEXT_KEYWORDS = [
  'item',
  'items',
  'billing',
  'settings',
  'checkout',
  'route',
  'routes',
];
const LAYOUT_CONTEXT_KEYWORDS = ['next', 'js', 'dashboard', 'page', 'route'];
const RENDER_OR_CONFIG_KEYWORDS = [
  'renders',
  'render',
  'set',
  'sets',
  'configured',
  'defined',
];

export function searchNavigationLayoutContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;

  const locator = hasLocator(tokens);
  if (!hasNavigationLayoutSubject(tokens)) return false;

  return locator || hasAnyToken(tokens, RENDER_OR_CONFIG_KEYWORDS) || tokens.size >= 3;
}

function hasNavigationLayoutSubject(tokens: Set<string>): boolean {
  return (
    hasNavigationSubject(tokens) ||
    hasBreadcrumbSubject(tokens) ||
    hasTitleSubject(tokens) ||
    hasLayoutSubject(tokens)
  );
}

function hasNavigationSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, NAVIGATION_KEYWORDS) && hasAnyToken(tokens, NAVIGATION_CONTEXT_KEYWORDS)
  );
}

function hasBreadcrumbSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['breadcrumb', 'breadcrumbs']);
}

function hasTitleSubject(tokens: Set<string>): boolean {
  return (tokens.has('page') && tokens.has('title')) || hasAnyToken(tokens, ['metadata', 'meta']);
}

function hasLayoutSubject(tokens: Set<string>): boolean {
  return tokens.has('layout') && hasAnyToken(tokens, LAYOUT_CONTEXT_KEYWORDS);
}

function hasLocator(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOCATOR_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
