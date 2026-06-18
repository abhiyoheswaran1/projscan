export function preflightReadyContextMatches(tokens: Set<string>): boolean {
  return (
    [
      'safe',
      'safety',
      'gate',
      'preflight',
      'commit',
      'merge',
      'edit',
      'proceed',
      'block',
      'blocked',
      'blocker',
      'blockers',
      'blocking',
      'allowed',
    ].some((token) => tokens.has(token)) || handoffContextMatches(tokens)
  );
}

export function preflightRiskContextMatches(tokens: Set<string>): boolean {
  return [
    'safe',
    'safety',
    'gate',
    'preflight',
    'commit',
    'merge',
    'merged',
    'merging',
    'proceed',
    'block',
    'blocked',
    'blocker',
    'blockers',
    'blocking',
    'allowed',
  ].some((token) => tokens.has(token));
}

export function preflightBranchRecoveryContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('test') || tokens.has('tests')) return false;
  const rebaseSignal = tokens.has('rebase') || tokens.has('rebasing');
  const conflictSignal = tokens.has('conflict') || tokens.has('conflicts');
  const resolveSignal = tokens.has('resolve') || tokens.has('resolving');
  const troubleSignal = tokens.has('wrong') || tokens.has('stuck');
  const mergeSignal =
    tokens.has('merge') ||
    tokens.has('merged') ||
    tokens.has('merging') ||
    tokens.has('main') ||
    tokens.has('branch');
  return (
    rebaseSignal ||
    ((conflictSignal || resolveSignal) && mergeSignal) ||
    (troubleSignal && (rebaseSignal || conflictSignal))
  );
}

function handoffContextMatches(tokens: Set<string>): boolean {
  return (
    tokens.has('handoff') ||
    tokens.has('handover') ||
    (tokens.has('hand') && tokens.has('off'))
  );
}
