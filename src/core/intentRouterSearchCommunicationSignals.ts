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
  'store',
  'stores',
  'retention',
  'pii',
  'gdpr',
  'security',
];

const LOCATOR_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];
const ARTIFACT_KEYWORDS = ['template', 'templates', 'copy', 'pdf'];
const SEND_ACTION_KEYWORDS = ['send', 'sends', 'sent', 'generated', 'created'];

export function searchCommunicationArtifactContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (hasAnyToken(tokens, SENSITIVE_CONTEXT_KEYWORDS)) return false;

  const locator = hasLocator(tokens);
  if (!hasCommunicationArtifactSubject(tokens)) return false;

  return locator || hasSendAction(tokens) || tokens.size >= 3;
}

function hasCommunicationArtifactSubject(tokens: Set<string>): boolean {
  return (
    hasEmailSubject(tokens) ||
    hasPushSubject(tokens) ||
    hasSmsSubject(tokens) ||
    hasReceiptSubject(tokens) ||
    hasInvoiceSubject(tokens)
  );
}

function hasEmailSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, ['email', 'emails']) &&
    (hasArtifact(tokens) || hasAnyToken(tokens, ['welcome', 'receipt', 'reset']))
  );
}

function hasPushSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('push') &&
    hasAnyToken(tokens, ['notification', 'notifications']) &&
    tokens.has('copy')
  );
}

function hasSmsSubject(tokens: Set<string>): boolean {
  return tokens.has('sms') && hasAnyToken(tokens, ['template', 'verification']);
}

function hasReceiptSubject(tokens: Set<string>): boolean {
  return tokens.has('receipt') && hasAnyToken(tokens, ['email', 'template']);
}

function hasInvoiceSubject(tokens: Set<string>): boolean {
  return tokens.has('invoice') && tokens.has('pdf');
}

function hasLocator(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOCATOR_KEYWORDS);
}

function hasArtifact(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ARTIFACT_KEYWORDS);
}

function hasSendAction(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, SEND_ACTION_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
