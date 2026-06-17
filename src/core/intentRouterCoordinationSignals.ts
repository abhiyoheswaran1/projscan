export function claimContextMatches(tokens: Set<string>): boolean {
  return ['claim', 'claims', 'lease', 'leases', 'reserve', 'lock'].some((token) =>
    tokens.has(token),
  );
}

export function claimKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (['claim', 'claims', 'lease', 'leases', 'reserve', 'lock'].includes(keyword)) return true;
  return claimContextMatches(tokens);
}

export function coordinateAgentContextMatches(tokens: Set<string>): boolean {
  return [
    'coordinate',
    'coordination',
    'status',
    'readiness',
    'parallel',
    'swarm',
    'collide',
    'colliding',
    'conflict',
    'conflicts',
    'conflicting',
    'conflicted',
    'worktree',
    'worktrees',
    'overlap',
  ].some((token) => tokens.has(token));
}

export function coordinateWorkingContextMatches(tokens: Set<string>): boolean {
  return (
    (tokens.has('working') || tokens.has('editing')) && (tokens.has('who') || tokens.has('else'))
  );
}

export function coordinateActiveContextMatches(tokens: Set<string>): boolean {
  return ['worktree', 'worktrees', 'agent', 'agents', 'parallel', 'swarm'].some((token) =>
    tokens.has(token),
  );
}

export function coordinateConflictContextMatches(tokens: Set<string>): boolean {
  return [
    'coordinate',
    'coordination',
    'parallel',
    'agents',
    'agent',
    'swarm',
    'worktree',
    'worktrees',
    'collide',
    'colliding',
    'overlap',
    'overlapping',
  ].some((token) => tokens.has(token));
}

export function collisionConflictContextMatches(tokens: Set<string>): boolean {
  return [
    'coordinate',
    'coordination',
    'parallel',
    'agents',
    'agent',
    'swarm',
    'worktree',
    'worktrees',
    'collision',
    'collide',
    'colliding',
    'overlap',
    'overlapping',
  ].some((token) => tokens.has(token));
}

export function collisionChangeContextMatches(tokens: Set<string>): boolean {
  return [
    'overlap',
    'overlapping',
    'conflict',
    'conflicts',
    'collision',
    'collide',
    'colliding',
    'worktree',
    'worktrees',
  ].some((token) => tokens.has(token));
}

export function mergeRiskKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (keyword === 'first')
    return ['merge', 'merged', 'merging', 'integrate', 'integration'].some((token) =>
      tokens.has(token),
    );
  if (keyword === 'branch')
    return ['first', 'order', 'sequence', 'integrate', 'integration'].some((token) =>
      tokens.has(token),
    );
  return true;
}

export function sessionLeaveOffContextMatches(tokens: Set<string>): boolean {
  return tokens.has('off') && (tokens.has('leave') || tokens.has('left'));
}

export function sessionAwayContextMatches(tokens: Set<string>): boolean {
  return (
    (tokens.has('away') || tokens.has('asleep') || tokens.has('slept') || tokens.has('offline')) &&
    ['changed', 'changes', 'change', 'last', 'previous', 'session', 'resume'].some((token) =>
      tokens.has(token),
    )
  );
}

export function sessionAgentContextMatches(tokens: Set<string>): boolean {
  if (!tokens.has('agent')) return false;
  if (tokens.has('touch') || tokens.has('touched')) return false;
  return [
    'last',
    'previous',
    'did',
    'do',
    'changed',
    'changes',
    'session',
    'events',
    'history',
  ].some((token) => tokens.has(token));
}
