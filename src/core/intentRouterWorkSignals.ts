function workplanDoContextMatches(tokens: Set<string>): boolean {
  return [
    'next',
    'plan',
    'workplan',
    'tasks',
    'task',
    'todo',
    'prioritize',
    'priorities',
    'roadmap',
    'full',
  ].some((token) => tokens.has(token));
}

export function workplanKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (keyword === 'do') return workplanDoContextMatches(tokens);
  if (['continue', 'keep', 'going', 'implementation', 'implementing'].includes(keyword)) {
    return ongoingWorkplanContextMatches(tokens);
  }
  if (
    [
      'build',
      'product',
      'products',
      'feature',
      'features',
      'strategy',
      'strategic',
      'priorities',
    ].includes(keyword)
  ) {
    return productPlanningContextMatches(tokens);
  }
  return true;
}

function ongoingWorkplanContextMatches(tokens: Set<string>): boolean {
  if (
    tokens.has('keep') &&
    ['going', 'improving', 'working', 'implementing'].some((token) => tokens.has(token))
  )
    return true;
  const planningSignal = [
    'continue',
    'plan',
    'workplan',
    'task',
    'tasks',
    'todo',
    'roadmap',
    'implementation',
    'implementing',
    'improving',
  ].some((token) => tokens.has(token));
  const ongoingSignal = ['continue', 'implementation', 'implementing', 'improving'].some((token) =>
    tokens.has(token),
  );
  return planningSignal && ongoingSignal;
}

function productPlanningContextMatches(tokens: Set<string>): boolean {
  const planningSignal = [
    'next',
    'plan',
    'workplan',
    'tasks',
    'task',
    'todo',
    'prioritize',
    'priorities',
    'roadmap',
    'strategy',
    'strategic',
  ].some((token) => tokens.has(token));
  const productSignal = ['build', 'product', 'products', 'feature', 'features'].some((token) =>
    tokens.has(token),
  );
  return planningSignal && productSignal;
}

export function bugHuntSpeedContextMatches(tokens: Set<string>): boolean {
  return (
    ['fix', 'issue', 'issues', 'bug', 'bugs', 'defect', 'broken', 'repair'].some((token) =>
      tokens.has(token),
    ) || bugHuntOpportunityContextMatches(tokens)
  );
}

export function bugHuntOpportunityContextMatches(tokens: Set<string>): boolean {
  if (
    (tokens.has('improve') || tokens.has('improvement')) &&
    tokens.has('next') &&
    !protectedImproveNextContextMatches(tokens)
  )
    return true;
  const opportunityTokens = [
    'quick',
    'quickest',
    'smallest',
    'small',
    'low',
    'lowest',
    'improve',
    'improvement',
    'useful',
    'easy',
    'beginner',
    'starter',
    'intern',
    'interns',
    'task',
    'tasks',
    'five',
    'minutes',
    'today',
    'win',
    'wins',
  ];
  const count = opportunityTokens.filter((token) => tokens.has(token)).length;
  return (
    count >= 2 ||
    [
      'intern',
      'interns',
      'fix',
      'issue',
      'issues',
      'bug',
      'bugs',
      'defect',
      'broken',
      'repair',
      'cleanup',
      'clean',
    ].some((token) => tokens.has(token))
  );
}

export function protectedImproveNextContextMatches(tokens: Set<string>): boolean {
  if (!(tokens.has('improve') || tokens.has('improvement')) || !tokens.has('next')) return false;
  if (noReleaseImproveNextContextMatches(tokens)) return false;
  return [
    'release',
    'releasing',
    'deploy',
    'deploying',
    'deployed',
    'deployment',
    'ship',
    'shipping',
    'publish',
    'tag',
    'changelog',
    'sbom',
    'dependency',
    'dependencies',
    'deps',
    'package',
    'packages',
    'supply-chain',
    'license',
    'licenses',
    'audit',
    'outdated',
    'upgrade',
    'vulnerable',
    'safe',
    'safety',
    'gate',
    'commit',
    'merge',
    'preflight',
    'blocker',
    'blockers',
    'risk',
    'risks',
  ].some((token) => tokens.has(token));
}

function noReleaseImproveNextContextMatches(tokens: Set<string>): boolean {
  const releaseAction = [
    'release',
    'releasing',
    'deploy',
    'deploying',
    'deployed',
    'deployment',
    'ship',
    'shipping',
    'publish',
    'tag',
  ].some((token) => tokens.has(token));
  const releaseProhibition = ['without', 'no', 'not', 'never'].some((token) => tokens.has(token));
  return releaseAction && releaseProhibition;
}
