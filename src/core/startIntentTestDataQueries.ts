export function extractTestDataQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (
    /\bseeds?\s+data\b|\bdata\s+seeds?\b|\bseed\s+database\b|\bdatabase\s+seed\b/i.test(
      compactIntent,
    )
  ) {
    return 'seed data';
  }

  const storybook = compactIntent.match(
    /\b(?:where\s+(?:are|is)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:storybook\s+)?stories\s+(?:for|of)\s+(.+?)$/i,
  );
  if (storybook?.[1]) return `${unwrapTarget(storybook[1].trim())} Storybook stories`;

  const storyRender = compactIntent.match(/\bwhich\s+stor(?:y|ies)\s+renders?\s+(.+?)$/i);
  if (storyRender?.[1]) return `${unwrapTarget(storyRender[1].trim())} story`;

  const fixtureLookup = compactIntent.match(
    /\b(?:where\s+(?:are|is)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:test\s+)?fixtures?\s+(?:for|of)\s+(.+?)$/i,
  );
  if (fixtureLookup?.[1]) return `${unwrapTarget(fixtureLookup[1].trim())} fixtures`;

  const mockUsage = compactIntent.match(
    /\bwhich\s+mocks?\s+(?:are\s+)?(?:used|configured)\s+(?:for|by|in)\s+(.+?)$/i,
  );
  if (mockUsage?.[1]) return `${unwrapTarget(mockUsage[1].trim())} mocks`;

  const factoryLookup = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:are|is))\s+(?:the\s+)?(?:factories?|factory)\s+(?:for|of)\s+(.+?)$/i,
  );
  if (factoryLookup?.[1]) return `${unwrapTarget(factoryLookup[1].trim())} factory`;
  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
