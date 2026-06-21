import { dependencyBloatContextMatches } from './intentRouterDependencySignals.js';
import { releaseChangeSummaryLookupContextMatches } from './intentRouterReleaseSignals.js';

export function prDiffKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const commitMessageContext = tokens.has('commit') && tokens.has('message');
  const commitSummaryContext =
    tokens.has('commit') &&
    (tokens.has('summarize') || tokens.has('summary')) &&
    (tokens.has('change') || tokens.has('changes') || tokens.has('changed') || tokens.has('diff'));
  if (keyword === 'commit') return commitMessageContext || commitSummaryContext;
  if (keyword === 'message') return commitMessageContext && tokens.has('message');
  if (['summarize', 'summary'].includes(keyword)) return commitSummaryContext;
  if (['large', 'big', 'size', 'sizes'].includes(keyword)) return prSizeContextMatches(tokens);
  if (['compare', 'stale', 'branched', 'behind', 'ahead', 'sync', 'synced'].includes(keyword))
    return branchSyncDiffContextMatches(tokens);
  if (keyword === 'change') {
    return (
      prSizeContextMatches(tokens) ||
      ['did', 'since', 'branch', 'main', 'base', 'head', 'pr', 'diff'].some((token) =>
        tokens.has(token),
      )
    );
  }
  if (['since', 'branch', 'main', 'base', 'head'].includes(keyword)) {
    return (
      branchSyncDiffContextMatches(tokens) ||
      releaseChangeSummaryLookupContextMatches(tokens) ||
      ['change', 'changed', 'changes', 'diff', 'pr', 'pull', 'request'].some((token) =>
        tokens.has(token),
      )
    );
  }
  if (['release', 'last', 'changelog', 'entry', 'current', 'work'].includes(keyword)) {
    return releaseChangeSummaryLookupContextMatches(tokens);
  }
  return true;
}

function prSizeContextMatches(tokens: Set<string>): boolean {
  if (dependencyBloatContextMatches(tokens)) return false;
  const sizeSignal = ['large', 'big', 'size', 'sizes'].some((token) => tokens.has(token));
  const changeSubject = ['pr', 'pull', 'request', 'change', 'changes', 'diff', 'branch'].some(
    (token) => tokens.has(token),
  );
  return sizeSignal && changeSubject;
}

function branchSyncDiffContextMatches(tokens: Set<string>): boolean {
  if (
    ['conflict', 'conflicts', 'resolve', 'resolving', 'rebase', 'rebasing'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const syncSignal = ['compare', 'stale', 'branched', 'behind', 'ahead', 'sync', 'synced'].some(
    (token) => tokens.has(token),
  );
  const branchSubject = ['branch', 'main', 'base', 'head'].some((token) => tokens.has(token));
  return syncSignal && branchSubject;
}
