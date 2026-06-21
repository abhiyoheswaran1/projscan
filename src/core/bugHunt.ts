import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { fixFirstFromBugHuntFinding } from './fixFirst.js';
import { hotspotToFinding } from './bugHuntHotspotFindings.js';
import {
  filesFromPreflightEvidence,
  preflightReasonToFinding,
} from './bugHuntPreflightFindings.js';
import { computePreflight } from './preflight.js';
import { scanRepository } from './repositoryScanner.js';
import { buildRiskNow } from './sessionResources.js';
import { buildCodeGraph } from './codeGraph.js';
import { loadConfig, applyConfigToIssues } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type {
  BugHuntFinding,
  BugHuntReport,
  BugHuntVerdict,
  Issue,
  PreflightReason,
  SessionConflict,
  WorkplanPriority,
} from '../types.js';

export interface ComputeBugHuntOptions {
  maxFindings?: number;
  since?: string;
}

const DEFAULT_MAX_FINDINGS = 10;

export async function computeBugHunt(
  rootPath: string,
  options: ComputeBugHuntOptions = {},
): Promise<BugHuntReport> {
  const maxFindings = normalizeMax(options.maxFindings);
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
  const issues = applyConfigToIssues(
    await collectIssues(rootPath, scan.files),
    configResult.config,
  );
  const health = calculateScore(issues);
  const preflight = await computePreflight(rootPath, { mode: 'before_commit' });
  const actionablePreflightReasons = preflight.reasons.filter(isActionablePreflightReason);
  const preflightChangedFiles = filesFromPreflightEvidence(
    preflight.evidence.changedFiles?.files ?? [],
  );
  const riskNow = await safeRiskNow(rootPath);
  const graph = await buildCodeGraph(rootPath, scan.files).catch(() => undefined);
  const hotspots = await analyzeHotspots(rootPath, scan.files, issues, {
    limit: maxFindings,
    since: options.since,
    ...(graph ? { graph } : {}),
  });

  const findings = rankFindings([
    ...issues.map(issueToFinding),
    ...actionablePreflightReasons.map((reason, index) =>
      preflightReasonToFinding(reason, index, preflightChangedFiles),
    ),
    ...riskNow.conflicts.map(conflictToFinding),
    ...hotspotFindings(hotspots),
  ]);

  const concreteFixes = findings.filter(isConcreteFixFinding);
  const reviewFindings = findings.filter(isReviewOnlyFinding);
  const verdict = bugHuntVerdict(issues, concreteFixes, reviewFindings, actionablePreflightReasons);
  const fixQueue = bugHuntFixQueue(verdict, concreteFixes, maxFindings);
  const reviewQueue = bugHuntReviewQueue(reviewFindings, maxFindings);
  const topSuspects = bugHuntTopSuspects(findings, fixQueue, maxFindings);
  const fixFirst = fixFirstFromBugHuntFinding(fixQueue[0]);

  return {
    schemaVersion: 1,
    verdict,
    summary: summarize(verdict, fixQueue, reviewQueue),
    health,
    evidence: bugHuntEvidence(
      health,
      hotspots.available ? hotspots.hotspots.length : 0,
      preflight.verdict,
      riskNow,
    ),
    topSuspects,
    fixQueue,
    reviewQueue,
    ...(fixFirst ? { fixFirst } : {}),
    verificationMatrix: buildVerificationMatrix(verdict, fixQueue),
    ...(bugHuntIsTruncated(
      findings,
      topSuspects,
      verdict,
      concreteFixes,
      fixQueue,
      reviewFindings,
      reviewQueue,
    )
      ? { truncated: true }
      : {}),
  };
}

function hotspotFindings(
  hotspots: Awaited<ReturnType<typeof analyzeHotspots>>,
): BugHuntFinding[] {
  return hotspots.available ? hotspots.hotspots.map(hotspotToFinding) : [];
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

function bugHuntEvidence(
  health: BugHuntReport['health'],
  hotspotCount: number,
  preflightVerdict: BugHuntReport['evidence']['preflightVerdict'],
  riskNow: { touchedFiles: string[]; conflicts: SessionConflict[] },
): BugHuntReport['evidence'] {
  return {
    issueCounts: {
      errors: health.errors,
      warnings: health.warnings,
      infos: health.infos,
    },
    hotspotCount,
    preflightVerdict,
    touchedFiles: riskNow.touchedFiles,
    conflicts: riskNow.conflicts.length,
  };
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

function issueToFinding(issue: Issue): BugHuntFinding {
  const files = filesFromIssue(issue);
  return {
    id: `bh-issue-${issue.id}`,
    priority: severityPriority(issue.severity),
    source: 'doctor',
    title: issue.title,
    why: issue.description,
    files,
    evidence: [
      {
        source: 'doctor',
        severity: issue.severity,
        issueId: issue.id,
        message: issue.title,
        ...(files[0] ? { file: files[0] } : {}),
      },
    ],
    suggestedTools: issue.fixAvailable
      ? ['projscan_explain_issue', 'projscan_fix_suggest', 'projscan_apply_fix']
      : ['projscan_explain_issue', 'projscan_doctor'],
    verification: {
      commands: ['projscan doctor --format json', 'npm test'],
      expected: `Issue ${issue.id} no longer appears in projscan doctor and focused tests pass.`,
    },
  };
}

function conflictToFinding(conflict: SessionConflict, index: number): BugHuntFinding {
  return {
    id: `bh-session-${index + 1}`,
    priority: conflict.severity === 'error' ? 'p0' : 'p1',
    source: 'session',
    title: 'Resolve active coordination conflict',
    why: conflict.message,
    files: conflict.files,
    evidence: [
      {
        source: 'coordination',
        severity: conflict.severity,
        message: conflict.message,
        ...(conflict.files[0] ? { file: conflict.files[0] } : {}),
      },
    ],
    suggestedTools: ['projscan_session', 'projscan_workplan'],
    verification: {
      commands: ['projscan session touched --format json', 'projscan bug-hunt --format json'],
      expected: 'Touched-file overlap is understood and no coordination blocker remains.',
    },
  };
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

function buildVerificationMatrix(
  verdict: BugHuntVerdict,
  fixQueue: BugHuntFinding[],
): BugHuntReport['verificationMatrix'] {
  if (verdict === 'review' || (fixQueue.length > 0 && fixQueue.every(isReleaseSignoffFinding))) {
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

function isActionablePreflightReason(reason: PreflightReason): boolean {
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

async function safeRiskNow(
  rootPath: string,
): Promise<{ touchedFiles: string[]; conflicts: SessionConflict[] }> {
  try {
    return await buildRiskNow(rootPath);
  } catch {
    return { touchedFiles: [], conflicts: [] };
  }
}

function summarize(
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

function isReviewOnlyFinding(finding: BugHuntFinding): boolean {
  return isReleaseSignoffFinding(finding);
}

function isReleaseSignoffFinding(finding: BugHuntFinding): boolean {
  return (
    finding.source === 'preflight' && finding.evidence.some((entry) => entry.source === 'release')
  );
}

function filesFromIssue(issue: Issue): string[] {
  return [...new Set((issue.locations ?? []).map((location) => location.file).filter(Boolean))];
}

function severityPriority(severity: Issue['severity']): WorkplanPriority {
  if (severity === 'error') return 'p0';
  if (severity === 'warning') return 'p1';
  return 'p2';
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

function normalizeMax(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_FINDINGS;
  return Math.max(1, Math.min(25, Math.floor(value)));
}
