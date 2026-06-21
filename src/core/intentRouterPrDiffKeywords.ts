export const PR_DIFF_RELEASE_SUMMARY_KEYWORDS = [
  'build',
  'built',
  'changelog',
  'commits',
  'current',
  'entry',
  'implement',
  'implemented',
  'last',
  'release',
  'work',
] as const;

export const PR_DIFF_KEYWORDS = [
  'commit',
  'commits',
  'message',
  'build',
  'built',
  'implement',
  'implemented',
  'summarize',
  'summary',
  'changelog',
  'entry',
  'current',
  'work',
  'release',
  'last',
  'pr',
  'diff',
  'changed',
  'changes',
  'change',
  'since',
  'branch',
  'stale',
  'main',
  'base',
  'head',
  'compare',
  'branched',
  'behind',
  'ahead',
  'sync',
  'synced',
  'large',
  'big',
  'size',
  'sizes',
  'exports',
  'imports',
  'calls',
  'callers',
] as const;

const PR_DIFF_KEYWORD_SET = new Set<string>(PR_DIFF_KEYWORDS);
const PR_DIFF_RELEASE_SUMMARY_KEYWORD_SET = new Set<string>(PR_DIFF_RELEASE_SUMMARY_KEYWORDS);

export function isPrDiffKeyword(keyword: string): boolean {
  return PR_DIFF_KEYWORD_SET.has(keyword);
}

export function isPrDiffReleaseSummaryKeyword(keyword: string): boolean {
  return PR_DIFF_RELEASE_SUMMARY_KEYWORD_SET.has(keyword);
}
