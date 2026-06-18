export function extractUiInteractionQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  return uiInteractionFromRules(compactIntent) ?? fixedUiInteractionQuery(compactIntent);
}

const UI_INTERACTION_RULES: Array<{ pattern: RegExp; suffix: string }> = [
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?)\s+forms?\s+(?:submitted|submit|handled)\b/i,
    suffix: 'form submit',
  },
  {
    pattern: /\b(?:what|which)\s+handles?\s+forms?\s+submit\s+(?:for|on|in)\s+(.+?)$/i,
    suffix: 'form submit',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?loading\s+state\s+(?:for|on|in)\s+(.+?)$/i,
    suffix: 'loading state',
  },
  {
    pattern: /\b(?:what|which)\s+renders?\s+empty\s+state\s+(?:for|of)\s+(.+?)$/i,
    suffix: 'empty state',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?error\s+boundary\s+(?:for|on|in)\s+(.+?)$/i,
    suffix: 'error boundary',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?toast(?:\s+(?:shown|displayed|triggered))?\s+(?:after|for|on|in)\s+(.+?)$/i,
    suffix: 'toast',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?keyboard\s+shortcuts?\s+(?:for|on)\s+(.+?)$/i,
    suffix: 'keyboard shortcut',
  },
  {
    pattern: /\b(?:what|which)\s+component\s+renders?\s+(?:the\s+)?(.+?)\s+page$/i,
    suffix: 'page component',
  },
  {
    pattern:
      /\b(?:where\s+(?:are|is)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:i18n\s+)?translations?\s+(?:for|of)\s+(.+?)$/i,
    suffix: 'translations',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?aria\s+labels?\s+(?:for|on)\s+(.+?)$/i,
    suffix: 'aria label',
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?modal\s+(?:opened|shown|displayed)\s+(?:for|on)\s+(.+?)$/i,
    suffix: 'modal',
  },
];

function uiInteractionFromRules(compactIntent: string): string | undefined {
  for (const rule of UI_INTERACTION_RULES) {
    const match = compactIntent.match(rule.pattern);
    if (match?.[1]) return `${unwrapTarget(match[1].trim())} ${rule.suffix}`;
  }
  return undefined;
}

function fixedUiInteractionQuery(compactIntent: string): string | undefined {
  if (/\bcommand\s+palette\s+actions?\b/i.test(compactIntent)) return 'command palette actions';
  if (/\bfocus\s+trap\b/i.test(compactIntent)) return 'focus trap';
  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
