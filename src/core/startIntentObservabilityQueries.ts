export function extractObservabilityQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const logCheck = compactIntent.match(
    /\b(?:what|which)\s+logs?\s+should\s+i\s+check\s+(?:for|about|on)\s+(.+?)$/i,
  );
  if (logCheck?.[1]) return `${unwrapTarget(logCheck[1].trim())} logs`;

  const dashboard = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?dashboards?\s+(?:for|about|on)\s+(.+?)$/i,
  );
  if (dashboard?.[1]) return `${unwrapTarget(dashboard[1].trim())} dashboard`;

  const serviceInit = compactIntent.match(
    /\b(?:where\s+(?:do|does)\s+(?:we\s+)?(?:initialize|initialise|init)|find|locate|search(?:\s+for)?|lookup)\s+(Sentry|Datadog|Prometheus)\b/i,
  );
  if (serviceInit?.[1]) return serviceInit[1];

  const observabilityTarget =
    '(?:metrics?|prometheus\\s+metrics?|alerts?|analytics\\s+events?|events?|sentry\\s+errors?|datadog)';
  const lookup = compactIntent.match(
    new RegExp(
      `\\b(?:where\\s+(?:are|is)|which|what|find|locate|search(?:\\s+for)?|lookup)\\s+(?:the\\s+)?(.*?\\b${observabilityTarget}\\b)(?:\\s+(?:emitted|sent|configured|handled|initialized|initialised|created|defined))?$`,
      'i',
    ),
  );
  if (lookup?.[1] && isObservabilityTarget(lookup[1]))
    return unwrapTarget(lookup[1].trim()).replace(/^the\s+/i, '');
  return undefined;
}

function isObservabilityTarget(target: string): boolean {
  return /\b(?:metric|metrics|prometheus|alert|alerts|analytics|events?|sentry|datadog|dashboard|dashboards|logs?)\b/i.test(
    target,
  );
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
