export function extractStateManagementQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (
    /\b(?:pii|gdpr|secret|secrets|token|tokens|password|customer|personal|leak|leaks|leaking|security|retention)\b/i.test(
      compactIntent,
    )
  )
    return undefined;
  return stateManagementFromRules(compactIntent) ?? frameworkStoreQuery(compactIntent);
}

const STATE_MANAGEMENT_RULES: Array<{ pattern: RegExp; suffix: string }> = [
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?)\s+state\s+(?:stored|store|stores)\b/i,
    suffix: 'state store',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?redux\s+slices?\s+(?:for|of|on|in)\s+(.+?)$/i,
    suffix: 'Redux slice',
  },
  {
    pattern:
      /\b(?:which|what|where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:context\s+)?providers?\s+(?:supplies|supplied|provides|provided|for|of)\s+(.+?)$/i,
    suffix: 'context provider',
  },
  {
    pattern: /\b(?:which|what)\s+hooks?\s+(?:fetch|fetches|loads?|queries?)\s+(.+?)$/i,
    suffix: 'hook',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?react\s+query\s+mutations?\s+(?:for|of|on|in)\s+(.+?)$/i,
    suffix: 'React Query mutation',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?react\s+query\s+quer(?:y|ies)\s+(?:for|of|on|in)\s+(.+?)$/i,
    suffix: 'React Query query',
  },
];

function stateManagementFromRules(compactIntent: string): string | undefined {
  for (const rule of STATE_MANAGEMENT_RULES) {
    const match = compactIntent.match(rule.pattern);
    if (match?.[1]) return `${unwrapTarget(match[1].trim())} ${rule.suffix}`;
  }
  return undefined;
}

function frameworkStoreQuery(compactIntent: string): string | undefined {
  const frameworkStore = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(redux|zustand|jotai|recoil)\s+stores?\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (frameworkStore?.[1] && frameworkStore[2]) {
    return `${unwrapTarget(frameworkStore[2].trim())} ${normalizeStateFramework(frameworkStore[1])} store`;
  }
  return undefined;
}

function normalizeStateFramework(value: string): string {
  return value
    .trim()
    .replace(/\bredux\b/gi, 'Redux')
    .replace(/\bzustand\b/gi, 'Zustand')
    .replace(/\bjotai\b/gi, 'Jotai')
    .replace(/\brecoil\b/gi, 'Recoil');
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
