import type {
  BugHuntFinding,
  BugHuntReport,
  BugHuntVerdict,
  Issue,
  PreflightReason,
  WorkplanPriority,
} from '../types.js';

export interface BugHuntQueueAssemblyInput {
  findings: BugHuntFinding[];
  issues: Issue[];
  actionablePreflightReasons: PreflightReason[];
  maxFindings: number;
}

export interface BugHuntQueueAssembly {
  rankedFindings: BugHuntFinding[];
  concreteFixes: BugHuntFinding[];
  reviewFindings: BugHuntFinding[];
  verdict: BugHuntVerdict;
  fixQueue: BugHuntFinding[];
  reviewQueue: BugHuntFinding[];
  topSuspects: BugHuntFinding[];
  truncated: boolean;
}

export function assembleBugHuntQueues({
  findings,
  issues,
  actionablePreflightReasons,
  maxFindings,
}: BugHuntQueueAssemblyInput): BugHuntQueueAssembly {
  const rankedFindings = rankFindings(findings);
  const concreteFixes = rankedFindings.filter(isConcreteFixFinding);
  const reviewFindings = rankedFindings.filter(isReviewOnlyFinding);
  const verdict = bugHuntVerdict(
    issues,
    concreteFixes,
    reviewFindings,
    actionablePreflightReasons,
  );
  const fixQueue = bugHuntFixQueue(verdict, concreteFixes, maxFindings);
  const reviewQueue = bugHuntReviewQueue(reviewFindings, maxFindings);
  const topSuspects = bugHuntTopSuspects(rankedFindings, fixQueue, maxFindings);

  return {
    rankedFindings,
    concreteFixes,
    reviewFindings,
    verdict,
    fixQueue,
    reviewQueue,
    topSuspects,
    truncated: bugHuntIsTruncated(
      rankedFindings,
      topSuspects,
      verdict,
      concreteFixes,
      fixQueue,
      reviewFindings,
      reviewQueue,
    ),
  };
}

export function summarizeBugHunt(
  verdict: BugHuntVerdict,
  fixQueue: BugHuntFinding[],
  reviewQueue: BugHuntFinding[],
): string {
  const queueLength = fixQueue.length;
  if (verdict === 'clean')
    return 'clean: bug hunt found no immediate fix targets; verify the baseline';
  if (verdict === 'block')
    return `block: bug hunt found ${queueLength} high-priority fix target(s)`;
  if (verdict === 'review' || (fixQueue.length > 0 && fixQueue.every(isReleaseSignoffFinding))) {
    const reviewCount = reviewQueue.length || queueLength;
    return `review: bug hunt found ${reviewCount} manual sign-off action(s)`;
  }
  return `fix: bug hunt found ${queueLength} prioritized fix target(s)`;
}

export function buildBugHuntVerificationMatrix(
  verdict: BugHuntVerdict,
  fixQueue: BugHuntFinding[],
): BugHuntReport['verificationMatrix'] {
  return needsManualSignoffVerification(verdict, fixQueue)
    ? manualSignoffVerificationMatrix()
    : fixVerificationMatrix(verdict);
}

function bugHuntFixQueue(
  verdict: BugHuntVerdict,
  immediateFixes: BugHuntFinding[],
  maxFindings: number,
): BugHuntFinding[] {
  if (verdict === 'review') return [];
  if (immediateFixes.length > 0) return immediateFixes.slice(0, maxFindings);
  return verdict === 'clean' ? [cleanVerificationFinding()] : [];
}

function bugHuntTopSuspects(
  findings: BugHuntFinding[],
  fixQueue: BugHuntFinding[],
  maxFindings: number,
): BugHuntFinding[] {
  return findings.length > 0 ? findings.slice(0, maxFindings) : fixQueue;
}

function bugHuntReviewQueue(
  reviewFindings: BugHuntFinding[],
  maxFindings: number,
): BugHuntFinding[] {
  return reviewFindings.slice(0, maxFindings);
}

function bugHuntIsTruncated(
  findings: BugHuntFinding[],
  topSuspects: BugHuntFinding[],
  verdict: BugHuntVerdict,
  concreteFixes: BugHuntFinding[],
  fixQueue: BugHuntFinding[],
  reviewFindings: BugHuntFinding[],
  reviewQueue: BugHuntFinding[],
): boolean {
  return (
    findings.length > topSuspects.length ||
    (verdict !== 'review' && concreteFixes.length > fixQueue.length) ||
    reviewFindings.length > reviewQueue.length
  );
}

function cleanVerificationFinding(): BugHuntFinding {
  return {
    id: 'bh-verify-clean',
    priority: 'p2',
    source: 'verification',
    title: 'Verify the clean bug-hunt baseline',
    why: 'No immediate doctor, preflight, session, or hotspot findings were found. Preserve that state with repeatable verification.',
    files: [],
    evidence: [{ source: 'verification', message: 'bug hunt found no ranked suspects' }],
    suggestedTools: ['projscan_doctor', 'projscan_preflight', 'projscan_workplan'],
    verification: {
      commands: [
        'projscan doctor --format json',
        'projscan preflight --mode before_commit --format json',
        'npm test',
      ],
      expected: 'The clean baseline remains reproducible before handoff.',
    },
  };
}

function rankFindings(findings: BugHuntFinding[]): BugHuntFinding[] {
  const seen = new Set<string>();
  return findings
    .map((finding, index) => ({ finding, index }))
    .filter((entry) => {
      const { finding } = entry;
      if (seen.has(finding.id)) return false;
      seen.add(finding.id);
      return true;
    })
    .sort((a, b) => {
      const priority = priorityRank(a.finding.priority) - priorityRank(b.finding.priority);
      if (priority !== 0) return priority;
      return sourceRank(a.finding.source) - sourceRank(b.finding.source) || a.index - b.index;
    })
    .map((entry) => entry.finding);
}

function needsManualSignoffVerification(
  verdict: BugHuntVerdict,
  fixQueue: BugHuntFinding[],
): boolean {
  return verdict === 'review' || (fixQueue.length > 0 && fixQueue.every(isReleaseSignoffFinding));
}

function manualSignoffVerificationMatrix(): BugHuntReport['verificationMatrix'] {
  return [
    {
      command: 'projscan preflight --mode before_commit --format json',
      reason: 'Confirms the manual sign-off gate and any remaining concrete blockers.',
      expected:
        'Manual sign-off is documented, or the preflight verdict returns proceed after review.',
    },
    {
      command: 'projscan doctor --format json',
      reason: 'Confirms no concrete doctor issue is hidden behind the review gate.',
      expected: 'No unresolved error-level issues and expected warning count is explained.',
    },
  ];
}

function fixVerificationMatrix(verdict: BugHuntVerdict): BugHuntReport['verificationMatrix'] {
  return [
    {
      command: 'projscan doctor --format json',
      reason: 'Confirms the issue queue after fixes.',
      expected: 'No unresolved error-level issues and expected warning count is explained.',
    },
    {
      command: 'projscan preflight --mode before_commit --format json',
      reason: 'Checks whether an agent can safely hand off or commit.',
      expected:
        verdict === 'block'
          ? 'Verdict improves from block after p0 fixes.'
          : 'Verdict is proceed or documented caution.',
    },
    {
      command: 'npm test',
      reason: 'Keeps the bug hunt tied to repeatable regression coverage.',
      expected: 'Focused tests and the project test suite pass.',
    },
  ];
}

function isConcreteFixFinding(finding: BugHuntFinding): boolean {
  return isImmediateFixFinding(finding) && !isReviewOnlyFinding(finding);
}

function isImmediateFixFinding(finding: BugHuntFinding): boolean {
  if (finding.source === 'verification') return false;
  if (finding.source !== 'hotspot') return true;
  return finding.evidence.some(
    (entry) => typeof entry.issueId === 'string' && entry.issueId.length > 0,
  );
}

function bugHuntVerdict(
  issues: Issue[],
  concreteFixes: BugHuntFinding[],
  reviewFindings: BugHuntFinding[],
  actionablePreflightReasons: PreflightReason[],
): BugHuntVerdict {
  if (
    issues.some((issue) => issue.severity === 'error') ||
    actionablePreflightReasons.some((reason) => reason.severity === 'error')
  ) {
    return 'block';
  }
  if (concreteFixes.length > 0) return 'fix';
  if (reviewFindings.length > 0) return 'review';
  if (actionablePreflightReasons.length > 0) return 'fix';
  return 'clean';
}

function isReviewOnlyFinding(finding: BugHuntFinding): boolean {
  return isReleaseSignoffFinding(finding);
}

function isReleaseSignoffFinding(finding: BugHuntFinding): boolean {
  return (
    finding.source === 'preflight' && finding.evidence.some((entry) => entry.source === 'release')
  );
}

function priorityRank(priority: WorkplanPriority): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

function sourceRank(source: BugHuntFinding['source']): number {
  if (source === 'doctor') return 0;
  if (source === 'preflight') return 1;
  if (source === 'session') return 2;
  if (source === 'hotspot') return 3;
  return 4;
}
