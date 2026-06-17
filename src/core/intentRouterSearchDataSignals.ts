import { packageScriptDiscoveryContextMatches } from './intentRouterRepoSignals.js';

export function searchDataContractContextMatches(tokens: Set<string>): boolean {
  if (packageScriptDiscoveryContextMatches(tokens)) return false;
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const validationSubject =
    ['validation', 'validate', 'validates', 'validator', 'schema', 'schemas', 'zod'].some((token) =>
      tokens.has(token),
    ) ||
    (tokens.has('input') &&
      ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup'].some((token) =>
        tokens.has(token),
      ));
  const parsingSubject =
    ['params', 'param'].some((token) => tokens.has(token)) &&
    ['request', 'query', 'parse', 'parses', 'parsed'].some((token) => tokens.has(token));
  const serializationSubject =
    ['json', 'serialize', 'serializes', 'serialization', 'response'].some((token) =>
      tokens.has(token),
    ) ||
    (['date', 'format', 'formats', 'formatting'].some((token) => tokens.has(token)) &&
      ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'defined'].some((token) =>
        tokens.has(token),
      ));
  const transactionSubject = tokens.has('transaction') || tokens.has('transactions');
  const lockingSubject =
    ['lock', 'locks', 'locking', 'optimistic'].some((token) => tokens.has(token)) &&
    ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'row', 'order', 'logic'].some(
      (token) => tokens.has(token),
    );
  const uniquenessSubject = ['unique', 'uniqueness', 'enforced'].some((token) => tokens.has(token));
  const paginationSubject = ['pagination', 'cursor', 'cursors'].some((token) => tokens.has(token));
  const subject =
    validationSubject ||
    parsingSubject ||
    serializationSubject ||
    transactionSubject ||
    lockingSubject ||
    uniquenessSubject ||
    paginationSubject;
  if (!subject) return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'input',
    'validates',
    'validation',
    'parsed',
    'parses',
    'serializes',
    'handled',
    'defined',
    'started',
    'wrap',
    'wraps',
    'lock',
    'locking',
    'enforced',
    'builds',
  ].some((token) => tokens.has(token));
}

export function searchDataAccessContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'sink',
      'sinks',
      'source',
      'taint',
      'injection',
      'xss',
      'vulnerability',
      'security',
      'sanitize',
      'sanitized',
      'reach',
      'reaches',
    ].some((token) => tokens.has(token))
  )
    return false;
  if (tokens.has('drop') || tokens.has('delete') || tokens.has('remove')) return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const orm = ['prisma', 'drizzle', 'typeorm', 'sequelize'].some((token) => tokens.has(token));
  const ormArtifact = ['model', 'models', 'schema', 'schemas', 'entity', 'entities'].some((token) =>
    tokens.has(token),
  );
  const sqlSubject = tokens.has('sql') && (tokens.has('query') || tokens.has('queries'));
  const repositorySubject =
    ['repository', 'repositories', 'dao', 'daos'].some((token) => tokens.has(token)) &&
    [
      'saves',
      'save',
      'persist',
      'persists',
      'orders',
      'payments',
      'find',
      'where',
      'which',
      'what',
    ].some((token) => tokens.has(token));
  const subject = (orm && ormArtifact) || sqlSubject || repositorySubject;
  if (!subject) return false;
  return (
    locator ||
    ['defined', 'configured', 'saves', 'save', 'persist', 'persists'].some((token) =>
      tokens.has(token),
    ) ||
    tokens.size >= 3
  );
}
