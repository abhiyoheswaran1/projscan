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
const FAILURE_KEYWORDS = [
  'fail',
  'failing',
  'failed',
  'failure',
  'failures',
  'error',
  'errors',
  'flake',
  'flaky',
  'slow',
  'slower',
];
const LOOKUP_KEYWORDS = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'];
const DEPLOY_CONTEXT_KEYWORDS = ['defined', 'configured', 'deploy', 'deploys', 'deployment'];
const HOSTED_CONFIG_KEYWORDS = ['vercel', 'netlify', 'railway', 'fly'];
const ORCHESTRATION_KEYWORDS = [
  'kubernetes',
  'k8s',
  'manifest',
  'manifests',
  'helm',
  'chart',
  'charts',
];

export function searchInfraArtifactContextMatches(tokens: Set<string>): boolean {
  if (hasAnyToken(tokens, IMPLEMENTATION_ACTION_KEYWORDS)) return false;
  if (hasAnyToken(tokens, FAILURE_KEYWORDS)) return false;
  if (!hasInfraArtifactSubject(tokens)) return false;
  return (
    hasAnyToken(tokens, LOOKUP_KEYWORDS) ||
    hasAnyToken(tokens, DEPLOY_CONTEXT_KEYWORDS) ||
    tokens.size >= 3
  );
}

function hasInfraArtifactSubject(tokens: Set<string>): boolean {
  return (
    hasDockerSubject(tokens) ||
    hasAnyToken(tokens, ORCHESTRATION_KEYWORDS) ||
    hasIacSubject(tokens) ||
    hasHostedConfigSubject(tokens) ||
    hasWorkflowDeploySubject(tokens)
  );
}

function hasDockerSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('dockerfile') ||
    tokens.has('containerfile') ||
    (tokens.has('docker') && tokens.has('compose'))
  );
}

function hasIacSubject(tokens: Set<string>): boolean {
  return (
    tokens.has('terraform') ||
    tokens.has('tf') ||
    tokens.has('cloudformation') ||
    tokens.has('cdk') ||
    tokens.has('pulumi') ||
    ((tokens.has('module') || tokens.has('modules')) && hasAnyToken(tokens, ['terraform', 'tf', 's3']))
  );
}

function hasHostedConfigSubject(tokens: Set<string>): boolean {
  return (
    hasAnyToken(tokens, HOSTED_CONFIG_KEYWORDS) &&
    hasAnyToken(tokens, ['config', 'configuration', 'deploy', 'deployment'])
  );
}

function hasWorkflowDeploySubject(tokens: Set<string>): boolean {
  return (
    tokens.has('github') &&
    (tokens.has('workflow') || tokens.has('workflows')) &&
    hasAnyToken(tokens, ['deploy', 'deploys', 'deployment', 'staging', 'production'])
  );
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
