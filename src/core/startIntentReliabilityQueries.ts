type QueryExtractor = (intent: string) => string | undefined;

export function extractReliabilityQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  return firstQuery(compactIntent, [
    extractRateLimitQuery,
    extractCacheQuery,
    extractRetryQuery,
    extractTimeoutQuery,
    extractResiliencePatternQuery,
  ]);
}

function firstQuery(intent: string, extractors: readonly QueryExtractor[]): string | undefined {
  for (const extract of extractors) {
    const query = extract(intent);
    if (query) return query;
  }
  return undefined;
}

function extractRateLimitQuery(compactIntent: string): string | undefined {
  const scopedRateLimit = compactIntent.match(
    /\b(?:what|which)\s+rate\s+limits?\s+(?:protects?|guards?|apply\s+to|for)\s+(.+?)$/i,
  );
  if (scopedRateLimit?.[1]) return `${unwrapTarget(scopedRateLimit[1].trim())} rate limits`;

  if (/\brate\s+limiting\b/i.test(compactIntent)) return 'rate limiting';
  if (/\brate\s+limits?\b/i.test(compactIntent)) return 'rate limits';
  if (/\bthrottl(?:e|ing)\b/i.test(compactIntent)) return 'throttling';
  return undefined;
}

function extractCacheQuery(compactIntent: string): string | undefined {
  const cacheFor = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?cache\s+(?:invalidated|cleared|expired|refreshed)\s+(?:for|on|in)\s+(.+?)$/i,
  );
  if (cacheFor?.[1]) return `${unwrapTarget(cacheFor[1].trim())} cache invalidation`;

  const invalidatesCache = compactIntent.match(/\bwhat\s+invalidates\s+(?:the\s+)?(.+?)\s+cache$/i);
  if (invalidatesCache?.[1])
    return `${unwrapTarget(invalidatesCache[1].trim())} cache invalidation`;

  const cacheConfigured = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\b(?:cache|redis)\b)\s+(?:configured|defined|created|used|handled)$/i,
  );
  if (cacheConfigured?.[1]) return unwrapTarget(cacheConfigured[1].trim());
  return undefined;
}

function extractRetryQuery(compactIntent: string): string | undefined {
  const retryFor = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?(?:retry|retries|backoff)\s+(?:logic\s+)?(?:for|on|in)\s+(.+?)$/i,
  );
  if (retryFor?.[1]) return `${unwrapTarget(retryFor[1].trim())} retry logic`;

  const retriesTarget = compactIntent.match(/\b(?:which|what)\s+(?:code\s+)?retries\s+(.+?)$/i);
  if (retriesTarget?.[1]) return `${unwrapTarget(retriesTarget[1].trim())} retries`;

  if (/\bbackoff\b/i.test(compactIntent)) return 'backoff';
  if (/\bretr(?:y|ies|ied)\b/i.test(compactIntent)) return 'retry logic';
  return undefined;
}

function extractTimeoutQuery(compactIntent: string): string | undefined {
  const timeoutFor = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?timeouts?\s+(?:configured|defined|set)?\s*(?:for|on|in)\s+(.+?)$/i,
  );
  if (timeoutFor?.[1]) return `${unwrapTarget(timeoutFor[1].trim())} timeout`;

  const timeoutTarget = compactIntent.match(/\b(?:what|which)\s+sets?\s+(.+?\btimeouts?)$/i);
  if (timeoutTarget?.[1]) return unwrapTarget(timeoutTarget[1].trim());
  return undefined;
}

function extractResiliencePatternQuery(compactIntent: string): string | undefined {
  if (/\bcircuit\s+breaker\b/i.test(compactIntent)) return 'circuit breaker';

  const idempotency = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?(.+?\bidempotenc(?:y|e)\b.*|idempotent\s+.+?)$/i,
  );
  if (idempotency?.[1]) return unwrapTarget(idempotency[1].trim());

  if (
    /\bwebhook\b/i.test(compactIntent) &&
    /\bsignatures?\b/i.test(compactIntent) &&
    /\b(?:verified|verify|verification)\b/i.test(compactIntent)
  ) {
    return 'webhook signature verification';
  }

  if (/\bdebounce(?:d)?\b/i.test(compactIntent)) return 'debounce';
  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
