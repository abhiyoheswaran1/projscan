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

const LOCATOR_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];

const DOMAIN_ACTION_KEYWORDS = [
  'handled',
  'handles',
  'implemented',
  'creates',
  'created',
  'generated',
  'sent',
  'export',
  'exports',
];

export function searchDomainWorkflowContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;

  const locator = hasLocator(tokens);
  const action = hasDomainAction(tokens);
  if (!hasDomainWorkflowSubject(tokens)) return false;

  return locator || action || tokens.size >= 3;
}

function hasDomainWorkflowSubject(tokens: Set<string>): boolean {
  return (
    hasPasswordResetSubject(tokens) ||
    hasInviteSubject(tokens) ||
    hasOnboardingSubject(tokens) ||
    hasCsvExportSubject(tokens) ||
    hasAuditLogSubject(tokens) ||
    hasRefundSubject(tokens) ||
    hasSubscriptionRenewalSubject(tokens)
  );
}

function hasPasswordResetSubject(tokens: Set<string>): boolean {
  return tokens.has('password') && tokens.has('reset');
}

function hasInviteSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['invite', 'invites']);
}

function hasOnboardingSubject(tokens: Set<string>): boolean {
  return tokens.has('onboarding') && hasAnyToken(tokens, ['flow', 'flows']);
}

function hasCsvExportSubject(tokens: Set<string>): boolean {
  return tokens.has('csv') && hasAnyToken(tokens, ['export', 'exports']);
}

function hasAuditLogSubject(tokens: Set<string>): boolean {
  return tokens.has('audit') && hasAnyToken(tokens, ['log', 'logs', 'entries']);
}

function hasRefundSubject(tokens: Set<string>): boolean {
  return tokens.has('refund');
}

function hasSubscriptionRenewalSubject(tokens: Set<string>): boolean {
  return tokens.has('subscription') && tokens.has('renewal');
}

function hasLocator(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOCATOR_KEYWORDS);
}

function hasDomainAction(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, DOMAIN_ACTION_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
