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

const LOCATOR_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];

const ARTIFACT_ACTION_KEYWORDS = [
  'defined',
  'defines',
  'configured',
  'generated',
  'handles',
  'handled',
];

export function searchApiContractContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (tokens.has('public') && hasAnyToken(tokens, ['contract', 'contracts'])) return false;

  const locator = hasLocator(tokens);
  const artifactAction = hasArtifactAction(tokens);
  if (!hasApiContractSubject(tokens, locator)) return false;

  return locator || artifactAction || tokens.size >= 3;
}

function hasApiContractSubject(tokens: Set<string>, locator: boolean): boolean {
  return (
    hasOpenApiSubject(tokens) ||
    hasTrpcSubject(tokens, locator) ||
    hasGraphqlSubject(tokens) ||
    hasProtoSubject(tokens)
  );
}

function hasOpenApiSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('openapi') ||
    tokens.has('swagger') ||
    (hasAnyToken(tokens, ['api', 'apis']) && hasAnyToken(tokens, ['spec', 'specs', 'docs']))
  );
}

function hasTrpcSubject(tokens: Set<string>, locator: boolean): boolean {
  return tokens.has('trpc') && (hasAnyToken(tokens, ['router', 'routers']) || locator);
}

function hasGraphqlSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('graphql') &&
    hasAnyToken(tokens, ['schema', 'schemas', 'resolver', 'resolvers', 'query', 'queries'])
  );
}

function hasProtoSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, ['protobuf', 'proto', 'protos']) ||
    (tokens.has('grpc') && hasAnyToken(tokens, ['service', 'services', 'client', 'clients']))
  );
}

function hasLocator(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOCATOR_KEYWORDS);
}

function hasArtifactAction(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ARTIFACT_ACTION_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
