export function extractApiContractQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  return (
    fixedApiContractQuery(compactIntent) ??
    apiContractFromRules(compactIntent) ??
    graphQlSchemaQuery(compactIntent)
  );
}

function fixedApiContractQuery(compactIntent: string): string | undefined {
  if (/\bopenapi\b/i.test(compactIntent) && /\bspecs?\b/i.test(compactIntent))
    return 'OpenAPI spec';
  if (/\bswagger\b/i.test(compactIntent) && /\bdocs?\b/i.test(compactIntent)) return 'Swagger docs';
  return undefined;
}

const API_CONTRACT_RULES: Array<{ pattern: RegExp; suffix: string }> = [
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?trpc\s+routers?\s+(?:for|of|on|in)\s+(.+?)$/i,
    suffix: 'tRPC router',
  },
  {
    pattern: /\b(?:which|what)\s+graphql\s+resolvers?\s+(?:handles?|for|of)\s+(.+?)$/i,
    suffix: 'GraphQL resolver',
  },
  { pattern: /\b(?:which|what)\s+(?:protobuf|proto)\s+defines?\s+(.+?)$/i, suffix: 'protobuf' },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?grpc\s+clients?\s+(?:for|of|on|in)\s+(.+?)$/i,
    suffix: 'gRPC client',
  },
];

function apiContractFromRules(compactIntent: string): string | undefined {
  for (const rule of API_CONTRACT_RULES) {
    const match = compactIntent.match(rule.pattern);
    if (match?.[1]) return `${unwrapTarget(match[1].trim())} ${rule.suffix}`;
  }
  return undefined;
}

function graphQlSchemaQuery(compactIntent: string): string | undefined {
  const graphqlSchema = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?graphql\s+schemas?\s*(?:for|of)?\s*(.*?)$/i,
  );
  if (graphqlSchema) {
    const target = unwrapTarget((graphqlSchema[1] ?? '').trim());
    return target ? `${target} GraphQL schema` : 'GraphQL schema';
  }
  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
