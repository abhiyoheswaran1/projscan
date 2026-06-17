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

const LOCATOR_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];

const STYLE_SIGNAL_KEYWORDS = [
  'defined',
  'define',
  'defines',
  'configured',
  'created',
  'loaded',
  'imported',
  'implemented',
  'handled',
  'styles',
  'style',
  'styled',
  'sets',
  'set',
];

const CSS_STYLE_SIGNAL_KEYWORDS = [
  'imported',
  'styles',
  'style',
  'styled',
  'defined',
  'configured',
];

export function searchStyleSystemContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (hasAnyToken(tokens, FAILURE_CONTEXT_KEYWORDS)) return false;

  const styleSignal = hasStyleSignal(tokens);
  if (!hasStyleSystemSubject(tokens, styleSignal)) return false;

  return hasLocator(tokens) || styleSignal || tokens.size >= 3;
}

function hasStyleSystemSubject(tokens: Set<string>, styleSignal: boolean): boolean {
  return (
    hasDesignTokenSubject(tokens) ||
    hasTailwindSubject(tokens, styleSignal) ||
    hasCssSubject(tokens) ||
    hasDarkModeSubject(tokens) ||
    hasBreakpointSubject(tokens) ||
    hasColorSubject(tokens, styleSignal)
  );
}

function hasDesignTokenSubject(tokens: Set<string>): boolean {
  return tokens.has('design') && hasAnyToken(tokens, ['token', 'tokens']);
}

function hasTailwindSubject(tokens: Set<string>, styleSignal: boolean): boolean {
  return (
    tokens.has('tailwind') &&
    (hasAnyToken(tokens, ['theme', 'themes', 'config', 'configuration']) || styleSignal)
  );
}

function hasCssSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('css') &&
    (hasAnyToken(tokens, ['global', 'module', 'modules']) ||
      hasAnyToken(tokens, CSS_STYLE_SIGNAL_KEYWORDS))
  );
}

function hasDarkModeSubject(tokens: Set<string>): boolean {
  return tokens.has('dark') && tokens.has('mode');
}

function hasBreakpointSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['breakpoint', 'breakpoints']);
}

function hasColorSubject(tokens: Set<string>, styleSignal: boolean): boolean {
  return (
    hasAnyToken(tokens, ['color', 'colors', 'palette', 'palettes']) &&
    (tokens.has('theme') || tokens.has('design') || styleSignal)
  );
}

function hasLocator(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOCATOR_KEYWORDS);
}

function hasStyleSignal(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, STYLE_SIGNAL_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
