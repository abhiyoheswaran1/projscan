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

const RELIABILITY_CONTEXT_KEYWORDS = [
  'where',
  'which',
  'what',
  'find',
  'locate',
  'search',
  'lookup',
  'code',
  'logic',
  'configured',
  'defined',
  'handled',
  'handling',
  'used',
  'set',
  'sets',
  'protect',
  'protects',
  'invalidate',
  'invalidates',
  'invalidated',
  'retry',
  'retries',
  'verified',
  'verify',
];

export function searchReliabilityContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (!hasReliabilitySubject(tokens)) return false;
  return hasAnyToken(tokens, RELIABILITY_CONTEXT_KEYWORDS);
}

function hasReliabilitySubject(tokens: Set<string>): boolean {
  return (
    hasRateLimitSubject(tokens) ||
    hasCacheSubject(tokens) ||
    hasRetrySubject(tokens) ||
    hasTimeoutSubject(tokens) ||
    hasCircuitBreakerSubject(tokens) ||
    hasIdempotencySubject(tokens) ||
    hasSignatureSubject(tokens) ||
    hasDebounceSubject(tokens)
  );
}

function hasRateLimitSubject(tokens: Set<string>): boolean {
  return (
    (hasAnyToken(tokens, ['rate', 'rates']) &&
      hasAnyToken(tokens, ['limit', 'limits', 'limiting'])) ||
    hasAnyToken(tokens, ['throttle', 'throttling'])
  );
}

function hasCacheSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, [
    'cache',
    'caches',
    'cached',
    'redis',
    'invalidate',
    'invalidates',
    'invalidated',
    'invalidation',
  ]);
}

function hasRetrySubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['retry', 'retries', 'retried', 'backoff']);
}

function hasTimeoutSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['timeout', 'timeouts']);
}

function hasCircuitBreakerSubject(tokens: Set<string>): boolean {
  return tokens.has('circuit') && tokens.has('breaker');
}

function hasIdempotencySubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['idempotency', 'idempotent']);
}

function hasSignatureSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, ['signature', 'signatures']) &&
    hasAnyToken(tokens, ['webhook', 'verified', 'verify', 'verification'])
  );
}

function hasDebounceSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['debounce', 'debounced']);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
