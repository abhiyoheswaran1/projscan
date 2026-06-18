type QueryExtractor = (intent: string) => string | undefined;

export function extractDataContractQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  return firstQuery(compactIntent, [
    extractValidationQuery,
    extractSerializationQuery,
    extractDatabaseConsistencyQuery,
    extractPaginationQuery,
  ]);
}

function firstQuery(intent: string, extractors: readonly QueryExtractor[]): string | undefined {
  for (const extract of extractors) {
    const query = extract(intent);
    if (query) return query;
  }
  return undefined;
}

function extractValidationQuery(compactIntent: string): string | undefined {
  const inputValidation = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?input\s+validation\s+(?:for|on|in)\s+(.+?)$/i,
  );
  if (inputValidation?.[1]) return `${unwrapTarget(inputValidation[1].trim())} input validation`;

  const schemaValidation = compactIntent.match(
    /\b(?:which|what|where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:zod\s+)?schemas?\s+(?:validates?|for|of)\s+(.+?)$/i,
  );
  if (schemaValidation?.[1]) return `${unwrapTarget(schemaValidation[1].trim())} validation schema`;

  const validationTarget = compactIntent.match(/\b(?:what|which)\s+validates?\s+(.+?)$/i);
  if (validationTarget?.[1]) {
    const target = unwrapTarget(validationTarget[1].trim());
    if (/\buniqueness\b/i.test(target)) return `${target} validation`;
    return `${target} validation`;
  }

  if (/\brequest\s+params?\s+(?:are\s+)?parsed\b/i.test(compactIntent))
    return 'request params parsing';
  if (/\bquery\s+params?\b/i.test(compactIntent)) return 'query params parsing';
  return undefined;
}

function extractSerializationQuery(compactIntent: string): string | undefined {
  const serializesResponse = compactIntent.match(
    /\b(?:what|which)\s+serializes?\s+(.+?\bresponse)\b/i,
  );
  if (serializesResponse?.[1]) return `${unwrapTarget(serializesResponse[1].trim())} serialization`;

  const serialization = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\b(?:serialization|formatting|format)\b)(?:\s+(?:handled|defined|configured))?$/i,
  );
  if (serialization?.[1]) return unwrapTarget(serialization[1].trim());
  return undefined;
}

function extractDatabaseConsistencyQuery(compactIntent: string): string | undefined {
  if (/\bdatabase\s+transactions?\b/i.test(compactIntent)) return 'database transaction';

  const transactionTarget = compactIntent.match(
    /\b(?:what|which)\s+wraps?\s+(.+?)\s+in\s+(?:a\s+)?transactions?\b/i,
  );
  if (transactionTarget?.[1]) return `${unwrapTarget(transactionTarget[1].trim())} transaction`;

  const rowLock = compactIntent.match(
    /\b(?:where\s+(?:do|does|is|are)(?:\s+we)?|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:code\s+that\s+)?locks?\s+(?:the\s+)?(.+?\brow)\b/i,
  );
  if (rowLock?.[1]) return `${unwrapTarget(rowLock[1].trim())} lock`;

  if (/\boptimistic\s+locking\b/i.test(compactIntent)) return 'optimistic locking';

  const uniquenessFor = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?uniqueness\s+(?:enforced|validated|checked)\s+(?:for|on|in)\s+(.+?)$/i,
  );
  if (uniquenessFor?.[1]) return `${unwrapTarget(uniquenessFor[1].trim())} uniqueness`;
  return undefined;
}

function extractPaginationQuery(compactIntent: string): string | undefined {
  if (/\bpagination\b/i.test(compactIntent) && /\bcursors?\b/i.test(compactIntent))
    return 'pagination cursors';
  if (/\bpagination\b/i.test(compactIntent)) return 'pagination';
  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
