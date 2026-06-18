export function extractDataAccessQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (
    /\b(?:sink|sinks|source|taint|injection|xss|vulnerability|security|sanitize|sanitized|reach|reaches|drop|delete|remove)\b/i.test(
      compactIntent,
    )
  )
    return undefined;
  return ormModelQuery(compactIntent) ?? dataAccessFromRules(compactIntent);
}

function ormModelQuery(compactIntent: string): string | undefined {
  const ormModel = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(prisma|drizzle|typeorm|sequelize)\s+(models?|schemas?|entities?)\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (ormModel?.[1] && ormModel[2] && ormModel[3]) {
    return `${unwrapTarget(ormModel[3].trim())} ${normalizeDataAccessFramework(ormModel[1])} ${normalizeDataAccessArtifact(ormModel[2])}`;
  }
  return undefined;
}

const DATA_ACCESS_RULES: Array<{
  pattern: RegExp;
  format: (match: RegExpMatchArray) => string | undefined;
}> = [
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?sql\s+quer(?:y|ies)\s+(?:for|of|on|in)\s+(.+?)$/i,
    format: (match) => (match[1] ? `${unwrapTarget(match[1].trim())} SQL query` : undefined),
  },
  {
    pattern:
      /\b(?:which|what)\s+(?:repository|repositories|dao|daos)\s+(?:saves?|persists?)\s+(.+?)$/i,
    format: (match) => (match[1] ? `${unwrapTarget(match[1].trim())} repository` : undefined),
  },
  {
    pattern:
      /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?(repository|repositories|dao|daos)\s+(?:for|of|on|in)\s+(.+?)$/i,
    format: (match) =>
      match[1] && match[2]
        ? `${unwrapTarget(match[2].trim())} ${/^dao/i.test(match[1]) ? 'DAO' : 'repository'}`
        : undefined,
  },
];

function dataAccessFromRules(compactIntent: string): string | undefined {
  for (const rule of DATA_ACCESS_RULES) {
    const match = compactIntent.match(rule.pattern);
    const query = match ? rule.format(match) : undefined;
    if (query) return query;
  }
  return undefined;
}

function normalizeDataAccessFramework(value: string): string {
  return value
    .trim()
    .replace(/\bprisma\b/gi, 'Prisma')
    .replace(/\bdrizzle\b/gi, 'Drizzle')
    .replace(/\btypeorm\b/gi, 'TypeORM')
    .replace(/\bsequelize\b/gi, 'Sequelize');
}

function normalizeDataAccessArtifact(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower.startsWith('entit')) return 'entity';
  if (lower.startsWith('schem')) return 'schema';
  return 'model';
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
