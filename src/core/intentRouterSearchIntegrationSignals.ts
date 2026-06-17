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

const GITHUB_WORKFLOW_KEYWORDS = ['action', 'actions', 'workflow', 'workflows', 'job', 'jobs', 'ci'];

const LOCATOR_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup'];

const NAMED_SERVICE_KEYWORDS = [
  'stripe',
  'sendgrid',
  's3',
  'github',
  'graphql',
  'websocket',
  'websockets',
  'socket',
  'sockets',
  'axios',
];

const GENERIC_SERVICE_KEYWORDS = [
  'integration',
  'integrations',
  'external',
  'service',
  'services',
  'client',
  'clients',
  'sdk',
  'sdks',
  'api',
  'apis',
];

const CALL_ACTION_KEYWORDS = [
  'call',
  'calls',
  'called',
  'send',
  'sends',
  'sent',
  'upload',
  'uploads',
  'uploaded',
];

export function searchIntegrationContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (isGithubWorkflowContext(tokens)) return false;

  const locator = hasLocator(tokens);
  const namedService = hasNamedService(tokens);
  const genericService = hasGenericService(tokens);
  const transportSubject = hasTransportSubject(tokens);
  const callAction = hasCallAction(tokens);

  if (
    !hasIntegrationSubject(
      tokens,
      locator,
      namedService,
      genericService,
      transportSubject,
      callAction,
    )
  )
    return false;
  return locator || callAction || tokens.size >= 3;
}

function isGithubWorkflowContext(tokens: Set<string>): boolean {
  return tokens.has('github') && hasAnyToken(tokens, GITHUB_WORKFLOW_KEYWORDS);
}

function hasIntegrationSubject(
  tokens: Set<string>,
  locator: boolean,
  namedService: boolean,
  genericService: boolean,
  transportSubject: boolean,
  callAction: boolean,
): boolean {
  return (
    hasEmailProviderSubject(tokens) ||
    hasStorageSubject(tokens) ||
    hasGraphSubject(tokens) ||
    hasSocketSubject(tokens) ||
    hasApiClientSubject(tokens, namedService) ||
    hasNamedServiceSubject(namedService, callAction, locator, genericService) ||
    hasGenericTransportSubject(genericService, transportSubject, callAction)
  );
}

function hasEmailProviderSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('email') &&
    (tokens.has('sendgrid') || hasAnyToken(tokens, ['send', 'sends', 'sent', 'through']))
  );
}

function hasStorageSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('s3') &&
    hasAnyToken(tokens, ['upload', 'uploads', 'uploaded', 'client', 'sdk', 'bucket'])
  );
}

function hasGraphSubject(tokens: Set<string>): boolean {
  return tokens.has('graphql') && hasAnyToken(tokens, ['query', 'queries', 'client', 'api']);
}

function hasSocketSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, ['websocket', 'websockets', 'socket', 'sockets']) &&
    hasAnyToken(tokens, ['connection', 'connections', 'opened', 'client'])
  );
}

function hasApiClientSubject(tokens: Set<string>, namedService: boolean): boolean {
  return namedService && hasAnyToken(tokens, ['api', 'apis', 'client', 'clients', 'sdk', 'sdks']);
}

function hasNamedServiceSubject(
  namedService: boolean,
  callAction: boolean,
  locator: boolean,
  genericService: boolean,
): boolean {
  return namedService && (callAction || locator || genericService);
}

function hasGenericTransportSubject(
  genericService: boolean,
  transportSubject: boolean,
  callAction: boolean,
): boolean {
  return (genericService || transportSubject) && callAction;
}

function hasLocator(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, LOCATOR_KEYWORDS);
}

function hasNamedService(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, NAMED_SERVICE_KEYWORDS);
}

function hasGenericService(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, GENERIC_SERVICE_KEYWORDS);
}

function hasTransportSubject(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, ['fetch', 'http', 'rest']);
}

function hasCallAction(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, CALL_ACTION_KEYWORDS);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
