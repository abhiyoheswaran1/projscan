function hasAny(tokens: Set<string>, words: readonly string[]): boolean {
  return words.some((word) => tokens.has(word));
}

export function productImprovementContextMatches(tokens: Set<string>): boolean {
  const usefulnessSignal = hasAny(tokens, [
    'useful',
    'usefulness',
    'helpful',
    'better',
    'improve',
    'improvement',
  ]);
  if (!usefulnessSignal) return false;

  const productContext = hasAny(tokens, [
    'engineer',
    'engineers',
    'user',
    'users',
    'team',
    'teams',
    'trust',
    'workflow',
    'workflows',
    'noisy',
    'noise',
    'daily',
    'product',
    'products',
  ]);
  if (!productContext) return false;

  return !hasAny(tokens, [
    'ci',
    'github',
    'action',
    'actions',
    'pipeline',
    'pipelines',
    'job',
    'jobs',
    'test',
    'tests',
    'build',
    'builds',
  ]);
}
