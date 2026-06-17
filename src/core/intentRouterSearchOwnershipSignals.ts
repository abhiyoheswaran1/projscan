export function searchOwnershipContextMatches(
  tokens: Set<string>,
  hasFilePath: boolean,
  claimContext: boolean,
): boolean {
  if (hasFilePath) return false;
  if (claimContext) return false;
  if (tokens.has('changed') && (tokens.has('file') || tokens.has('files'))) return false;
  if (
    ['pr', 'pull', 'request', 'review', 'reviewer', 'reviewers'].some((token) => tokens.has(token))
  )
    return false;
  const ownershipSignal = ['owner', 'owners', 'ownership', 'owns', 'team'].some((token) =>
    tokens.has(token),
  );
  const helpSignal = ['ask', 'help', 'knows', 'expert', 'experts', 'contact', 'contacts'].some(
    (token) => tokens.has(token),
  );
  const lookupSignal = ['who', 'which', 'find', 'locate', 'search', 'where'].some((token) =>
    tokens.has(token),
  );
  return (ownershipSignal && (lookupSignal || tokens.has('area'))) || (helpSignal && lookupSignal);
}
