import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { fixFirstFromBugHuntFinding } from './fixFirst.js';
import { computePreflight } from './preflight.js';
import { scanRepository } from './repositoryScanner.js';
import { buildRiskNow } from './sessionResources.js';
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
  const issues = applyConfigToIssues(await collectIssues(rootPath, scan.files), configResult.config);
  const health = calculateScore(issues);
  const preflight = await computePreflight(rootPath, { mode: 'before_commit' });
  const actionablePreflightReasons = preflight.reasons.filter(isActionablePreflightReason);
  const riskNow = await safeRiskNow(rootPath);
  const hotspots = await analyzeHotspots(rootPath, scan.files, issues, {
    limit: maxFindings,
    since: options.since,
  });

  const findings = rankFindings([
    ...issues.map(issueToFinding),
    ...actionablePreflightReasons.map(preflightReasonToFinding),
    ...riskNow.conflicts.map(conflictToFinding),
    ...(hotspots.available ? hotspots.hotspots.map(hotspotToFinding) : []),
  ]);

  const immediateFixes = findings.filter(isImmediateFixFinding);
  const fixQueue = immediateFixes.length > 0
    ? immediateFixes.slice(0, maxFindings)
    : [cleanVerificationFinding()];
  const topSuspects = findings.length > 0 ? findings.slice(0, maxFindings) : fixQueue;
  const verdict = bugHuntVerdict(issues, immediateFixes, actionablePreflightReasons);
  const fixFirst = fixFirstFromBugHuntFinding(fixQueue[0]);

  return {
    schemaVersion: 1,
    verdict,
    summary: summarize(verdict, fixQueue.length),
    health,
    evidence: {
      issueCounts: {
        errors: health.errors,
        warnings: health.warnings,
        infos: health.infos,
      },
      hotspotCount: hotspots.available ? hotspots.hotspots.length : 0,
      preflightVerdict: preflight.verdict,
      touchedFiles: riskNow.touchedFiles,
      conflicts: riskNow.conflicts.length,
    },
    topSuspects,
    fixQueue,
    ...(fixFirst ? { fixFirst } : {}),
    verificationMatrix: buildVerificationMatrix(verdict),
    ...(findings.length > topSuspects.length || immediateFixes.length > fixQueue.length ? { truncated: true } : {}),
  };
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

function preflightReasonToFinding(reason: PreflightReason, index: number): BugHuntFinding {
  return {
    id: `bh-preflight-${index + 1}`,
    priority: severityPriority(reason.severity),
    source: 'preflight',
    title: `Resolve preflight ${reason.source} signal`,
    why: reason.message,
    files: reason.file ? [reason.file] : [],
    evidence: [
      {
        source: reason.source,
        severity: reason.severity,
        message: reason.message,
        ...(reason.file ? { file: reason.file } : {}),
        ...(reason.issueId ? { issueId: reason.issueId } : {}),
        ...(reason.tool ? { tool: reason.tool } : {}),
      },
    ],
    suggestedTools: ['projscan_preflight', reason.tool ?? 'projscan_doctor'],
    verification: {
      commands: ['projscan preflight --mode before_commit --format json', 'projscan doctor --format json'],
      expected: 'The preflight reason is gone or intentionally documented as accepted risk.',
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

function hotspotToFinding(
  hotspot: { relativePath: string; riskScore: number; reasons: string[]; issueIds: string[] },
): BugHuntFinding {
  return {
    id: `bh-hotspot-${slug(hotspot.relativePath)}`,
    priority: hotspot.issueIds.length > 0 ? (hotspot.riskScore >= 70 ? 'p1' : 'p2') : 'p2',
    source: 'hotspot',
    title: `${hotspot.issueIds.length > 0 ? 'Inspect' : 'Watch'} risky hotspot ${hotspot.relativePath}`,
    why: hotspot.reasons[0] ?? `Risk score ${Math.round(hotspot.riskScore)} combines churn, complexity, and issue density.`,
    files: [hotspot.relativePath],
    evidence: [
      {
        source: 'hotspots',
        message: `risk score ${Math.round(hotspot.riskScore)}`,
        file: hotspot.relativePath,
      },
      ...hotspot.issueIds.slice(0, 3).map((issueId) => ({
        source: 'doctor' as const,
        message: `linked issue ${issueId}`,
        issueId,
        file: hotspot.relativePath,
      })),
    ],
    suggestedTools: ['projscan_file', 'projscan_hotspots', 'projscan_impact'],
    verification: {
      commands: [`projscan file ${hotspot.relativePath} --format json`, 'npm test'],
      expected: 'The hotspot has either lower risk, added regression coverage, or an explicit owner for remaining risk.',
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
      commands: ['projscan doctor --format json', 'projscan preflight --mode before_commit --format json', 'npm test'],
      expected: 'The clean baseline remains reproducible before handoff.',
    },
  };
}

function rankFindings(findings: BugHuntFinding[]): BugHuntFinding[] {
  const seen = new Set<string>();
  return findings
    .filter((finding) => {
      if (seen.has(finding.id)) return false;
      seen.add(finding.id);
      return true;
    })
    .sort((a, b) => {
      const priority = priorityRank(a.priority) - priorityRank(b.priority);
      if (priority !== 0) return priority;
      return sourceRank(a.source) - sourceRank(b.source) || a.id.localeCompare(b.id);
    });
}

function buildVerificationMatrix(verdict: BugHuntVerdict): BugHuntReport['verificationMatrix'] {
  return [
    {
      command: 'projscan doctor --format json',
      reason: 'Confirms the issue queue after fixes.',
      expected: 'No unresolved error-level issues and expected warning count is explained.',
    },
    {
      command: 'projscan preflight --mode before_commit --format json',
      reason: 'Checks whether an agent can safely hand off or commit.',
      expected: verdict === 'block' ? 'Verdict improves from block after p0 fixes.' : 'Verdict is proceed or documented caution.',
    },
    {
      command: 'npm test',
      reason: 'Keeps the bug hunt tied to repeatable regression coverage.',
      expected: 'Focused tests and the project test suite pass.',
    },
  ];
}

function isImmediateFixFinding(finding: BugHuntFinding): boolean {
  if (finding.source === 'verification') return false;
  if (finding.source !== 'hotspot') return true;
  return finding.evidence.some((entry) => typeof entry.issueId === 'string' && entry.issueId.length > 0);
}

function bugHuntVerdict(
  issues: Issue[],
  findings: BugHuntFinding[],
  actionablePreflightReasons: PreflightReason[],
): BugHuntVerdict {
  if (
    issues.some((issue) => issue.severity === 'error') ||
    actionablePreflightReasons.some((reason) => reason.severity === 'error')
  ) {
    return 'block';
  }
  if (findings.length > 0 || actionablePreflightReasons.length > 0) return 'fix';
  return 'clean';
}

function isActionablePreflightReason(reason: PreflightReason): boolean {
  if (reason.source === 'review' && reason.message.startsWith('Review unavailable:')) return false;
  if ((reason.source === 'review' || reason.source === 'taint') && !reason.file && !reason.issueId) {
    return false;
  }
  if (reason.severity === 'error') return true;
  return reason.source !== 'git' && reason.source !== 'changed-files';
}

async function safeRiskNow(rootPath: string): Promise<{ touchedFiles: string[]; conflicts: SessionConflict[] }> {
  try {
    return await buildRiskNow(rootPath);
  } catch {
    return { touchedFiles: [], conflicts: [] };
  }
}

function summarize(verdict: BugHuntVerdict, queueLength: number): string {
  if (verdict === 'clean') return 'clean: bug hunt found no immediate fix targets; verify the baseline';
  if (verdict === 'block') return `block: bug hunt found ${queueLength} high-priority fix target(s)`;
  return `fix: bug hunt found ${queueLength} prioritized fix target(s)`;
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

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';
}
