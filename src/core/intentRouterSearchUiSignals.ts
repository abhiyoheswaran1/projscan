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
const UI_INTERACTION_CONTEXT_KEYWORDS = [
  'where',
  'which',
  'what',
  'find',
  'locate',
  'search',
  'lookup',
  'handles',
  'handled',
  'renders',
  'render',
  'shown',
  'triggers',
  'triggered',
  'opened',
  'implemented',
];

export function searchUiInteractionContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (!hasUiInteractionSubject(tokens)) return false;
  return hasAnyToken(tokens, UI_INTERACTION_CONTEXT_KEYWORDS) || tokens.size >= 3;
}

function hasUiInteractionSubject(tokens: Set<string>): boolean {
  return (
    hasFormSubject(tokens) ||
    hasStateSubject(tokens) ||
    hasFeedbackSubject(tokens) ||
    hasShortcutSubject(tokens) ||
    hasComponentSurfaceSubject(tokens) ||
    hasLanguageOrAccessibilitySubject(tokens)
  );
}

function hasFormSubject(tokens: Set<string>): boolean {
  return (
    (tokens.has('form') || tokens.has('forms')) &&
    hasAnyToken(tokens, ['submit', 'submits', 'submitted', 'handles', 'handled'])
  );
}

function hasStateSubject(tokens: Set<string>): boolean {
  return (
    (tokens.has('state') && hasAnyToken(tokens, ['loading', 'empty', 'error'])) ||
    (tokens.has('empty') && tokens.has('results'))
  );
}

function hasFeedbackSubject(tokens: Set<string>): boolean {
  return (
    (tokens.has('boundary') && tokens.has('error')) ||
    hasAnyToken(tokens, ['toast', 'notification', 'notifications'])
  );
}

function hasShortcutSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('keyboard') ||
    tokens.has('shortcut') ||
    tokens.has('shortcuts') ||
    (tokens.has('command') && tokens.has('palette'))
  );
}

function hasComponentSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('component') &&
    (tokens.has('page') || tokens.has('renders') || tokens.has('render'))
  );
}

function hasComponentSurfaceSubject(tokens: Set<string>): boolean {
  return tokens.has('modal') || hasComponentSubject(tokens);
}

function hasLanguageOrAccessibilitySubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, ['i18n', 'translation', 'translations']) ||
    tokens.has('aria') ||
    (tokens.has('focus') && tokens.has('trap'))
  );
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
