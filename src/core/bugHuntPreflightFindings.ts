import type { BugHuntFinding, PreflightEvidence, PreflightReason } from '../types.js';

export function preflightReasonToFinding(
  reason: PreflightReason,
  index: number,
  changedFiles: string[] = [],
): BugHuntFinding {
  const files = reason.file ? [reason.file] : changedFiles;
  return {
    id: `bh-preflight-${index + 1}`,
    priority: preflightSeverityPriority(reason.severity),
    source: 'preflight',
    title: preflightReasonTitle(reason),
    why: reason.message,
    files,
    evidence: [
      {
        source: reason.source,
        severity: reason.severity,
        message: reason.message,
        ...(files[0] ? { file: files[0] } : {}),
        ...(reason.issueId ? { issueId: reason.issueId } : {}),
        ...(reason.tool ? { tool: reason.tool } : {}),
      },
    ],
    suggestedTools: ['projscan_preflight', reason.tool ?? 'projscan_doctor'],
    verification: {
      commands: [
        'projscan preflight --mode before_commit --format json',
        'projscan doctor --format json',
      ],
      expected: 'The preflight reason is gone or intentionally documented as accepted risk.',
    },
  };
}

export function filesFromPreflightEvidence(files: string[]): string[] {
  const contextFiles = files.filter((file) => !isProjscanRuntimePath(file));
  if (contextFiles.length === 0) return files;

  const reviewableFiles = sortReviewContextFiles(
    contextFiles.filter((file) => !isAgentRuntimePath(file)),
  );
  if (reviewableFiles.length === 0) return contextFiles;

  const runtimeFiles = contextFiles.filter(isAgentRuntimePath);
  return [...reviewableFiles, ...runtimeFiles];
}

export function isActionablePreflightReason(
  reason: PreflightReason,
  evidence: PreflightEvidence,
): boolean {
  if (isBranchOnlyReleaseScaleReason(reason, evidence)) return false;
  if (reason.source === 'review' && reason.message.startsWith('Review unavailable:')) return false;
  if (
    (reason.source === 'review' || reason.source === 'taint') &&
    !reason.file &&
    !reason.issueId
  ) {
    return false;
  }
  if (reason.severity === 'error') return true;
  return reason.source !== 'git' && reason.source !== 'changed-files';
}

function isBranchOnlyReleaseScaleReason(
  reason: PreflightReason,
  evidence: PreflightEvidence,
): boolean {
  const worktree = evidence.riskSources?.currentWorktree;
  return (
    reason.source === 'release' &&
    worktree?.uncommittedChangedFileCount === 0 &&
    (worktree.branchChangedFileCount ?? 0) > 0
  );
}

function preflightReasonTitle(reason: PreflightReason): string {
  if (reason.source === 'release') {
    return /handoff review|manual review sign-off/i.test(reason.message)
      ? 'Review preflight manual sign-off'
      : 'Review preflight release sign-off';
  }
  return `Resolve preflight ${reason.source} signal`;
}

function preflightSeverityPriority(severity: PreflightReason['severity']): BugHuntFinding['priority'] {
  if (severity === 'error') return 'p0';
  if (severity === 'warning') return 'p1';
  return 'p2';
}

function sortReviewContextFiles(files: string[]): string[] {
  return files
    .map((file, index) => ({ file, index }))
    .sort((left, right) => {
      const byKind = compareRanks(reviewContextRank(left.file), reviewContextRank(right.file));
      if (byKind) return byKind;
      const byPackage = compareRanks(
        packageMetadataRank(left.file),
        packageMetadataRank(right.file),
      );
      if (byPackage) return byPackage;
      return left.index - right.index;
    })
    .map((entry) => entry.file);
}

const PACKAGE_METADATA_RANKS: Array<{ rank: number; pattern: RegExp }> = [
  { rank: 0, pattern: /^package\.json$/ },
  {
    rank: 1,
    pattern:
      /^(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|bun\.lockb)$/,
  },
  { rank: 2, pattern: /(^|\/)package\.json$/ },
  {
    rank: 3,
    pattern:
      /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|bun\.lockb)$/,
  },
];

const REVIEW_CONTEXT_RANKS: Array<{ rank: number; pattern: RegExp; exclude?: RegExp }> = [
  {
    rank: 0,
    pattern:
      /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|bun\.lockb)$/,
  },
  { rank: 1, pattern: /^src\//, exclude: /(^|[/.-])(test|spec)\.[cm]?[jt]sx?$/ },
  { rank: 2, pattern: /(^tests?\/|(^|[/.-])(test|spec)\.[cm]?[jt]sx?$)/ },
  { rank: 3, pattern: /(^docs\/|(^|\/)(README|CHANGELOG)\.md$|\.md$)/ },
];

function reviewContextRank(file: string): number {
  return rankedPatternMatch(normalizeReviewPath(file), REVIEW_CONTEXT_RANKS) ?? 4;
}

function packageMetadataRank(file: string): number {
  return rankedPatternMatch(normalizeReviewPath(file), PACKAGE_METADATA_RANKS) ?? 4;
}

function rankedPatternMatch(
  path: string,
  ranks: Array<{ rank: number; pattern: RegExp; exclude?: RegExp }>,
): number | null {
  const match = ranks.find((rank) => rank.pattern.test(path) && !rank.exclude?.test(path));
  return match?.rank ?? null;
}

function compareRanks(left: number, right: number): number {
  return left === right ? 0 : left - right;
}

function normalizeReviewPath(file: string): string {
  return file.replace(/\\/g, '/');
}

function isProjscanRuntimePath(file: string): boolean {
  return (
    file === '.projscan-cache' ||
    file.startsWith('.projscan-cache/') ||
    file === '.projscan-memory' ||
    file.startsWith('.projscan-memory/')
  );
}

function isAgentRuntimePath(file: string): boolean {
  return (
    file === '.agentflight' ||
    file.startsWith('.agentflight/') ||
    file === '.agentloop' ||
    file.startsWith('.agentloop/')
  );
}
