import type { CoordinationSummary } from './coordination.js';
import type {
  HealthScore,
  HotspotReport,
  Issue,
  PreflightEvidence,
  PreflightReleaseScaleEvidence,
} from '../types.js';
import type { ReviewReport } from '../types/review.js';

export const MAX_PREFLIGHT_EVIDENCE_FILES = 40;

interface ChangedFilesEvidence {
  available: boolean;
  count: number;
  files: string[];
  baseRef: string | null;
  branchChangedFileCount: number;
  uncommittedChangedFileCount: number;
  uncommittedFiles: string[];
  reason?: string;
}

interface SessionEvidence {
  id: string;
  touchedFiles: string[];
  eventCount: number;
}

interface ReviewEvidence {
  available: boolean;
  verdict?: ReviewReport['verdict'];
  summary?: string;
  reason?: string;
}

export function buildEvidence(input: {
  health: HealthScore;
  changedFiles: ChangedFilesEvidence;
  session: SessionEvidence;
  hotspots: HotspotReport | null;
  issues: Issue[];
  pluginsEnabledForRun: boolean;
  review: ReviewEvidence;
  releaseScale: PreflightReleaseScaleEvidence | null;
  coordination: CoordinationSummary | null;
}): PreflightEvidence {
  const changedEvidenceFiles = input.changedFiles.files.slice(0, MAX_PREFLIGHT_EVIDENCE_FILES);
  const sessionTouchedFiles = input.session.touchedFiles.slice(0, MAX_PREFLIGHT_EVIDENCE_FILES);
  return {
    health: healthEvidence(input.health),
    changedFiles: changedFilesEvidence(input.changedFiles, changedEvidenceFiles),
    review: reviewEvidence(input.review),
    session: sessionEvidence(input.session, sessionTouchedFiles),
    riskSources: riskSourcesEvidence(input.changedFiles, input.session, {
      changedEvidenceFiles,
      sessionTouchedFiles,
    }),
    hotspots: { touched: touchedHotspotEvidence(input.hotspots, input.session) },
    plugins: pluginEvidence(input.issues, input.pluginsEnabledForRun),
    supplyChain: supplyChainEvidence(input.issues),
    ...(input.releaseScale ? { releaseScale: input.releaseScale } : {}),
    ...(input.coordination ? { coordination: coordinationEvidence(input.coordination) } : {}),
  };
}

function healthEvidence(health: HealthScore): PreflightEvidence['health'] {
  return {
    score: health.score,
    grade: health.grade,
    errors: health.errors,
    warnings: health.warnings,
    infos: health.infos,
  };
}

function changedFilesEvidence(
  changedFiles: ChangedFilesEvidence,
  files: string[],
): NonNullable<PreflightEvidence['changedFiles']> {
  return {
    available: changedFiles.available,
    count: changedFiles.count,
    files,
    ...(changedFiles.reason ? { reason: changedFiles.reason } : {}),
  };
}

function reviewEvidence(review: ReviewEvidence): NonNullable<PreflightEvidence['review']> {
  return {
    available: review.available,
    ...(review.verdict ? { verdict: review.verdict } : {}),
    ...(review.summary ? { summary: review.summary } : {}),
    ...(review.reason ? { reason: review.reason } : {}),
  };
}

function sessionEvidence(
  session: SessionEvidence,
  touchedFiles: string[],
): NonNullable<PreflightEvidence['session']> {
  return {
    kind: 'remembered-session',
    id: session.id,
    touchedFiles,
    totalTouchedFiles: session.touchedFiles.length,
    eventCount: session.eventCount,
    note: 'remembered session context comes from previous projscan tool results, explicit touches, and MCP file-watch events. It is not the same as current Git/worktree changes.',
    ...(session.touchedFiles.length > MAX_PREFLIGHT_EVIDENCE_FILES ? { truncated: true } : {}),
  };
}

function riskSourcesEvidence(
  changedFiles: ChangedFilesEvidence,
  session: SessionEvidence,
  files: { changedEvidenceFiles: string[]; sessionTouchedFiles: string[] },
): NonNullable<PreflightEvidence['riskSources']> {
  return {
    currentWorktree: currentWorktreeEvidence(changedFiles, files.changedEvidenceFiles),
    sessionMemory: sessionMemoryEvidence(session, files.sessionTouchedFiles),
  };
}

function currentWorktreeEvidence(
  changedFiles: ChangedFilesEvidence,
  files: string[],
): NonNullable<PreflightEvidence['riskSources']>['currentWorktree'] {
  return {
    kind: 'current-worktree',
    available: changedFiles.available,
    count: changedFiles.count,
    files,
    baseRef: changedFiles.baseRef,
    branchChangedFileCount: changedFiles.branchChangedFileCount,
    uncommittedChangedFileCount: changedFiles.uncommittedChangedFileCount,
    uncommittedFiles: changedFiles.uncommittedFiles.slice(0, MAX_PREFLIGHT_EVIDENCE_FILES),
    ...(changedFiles.reason ? { reason: changedFiles.reason } : {}),
  };
}

function sessionMemoryEvidence(
  session: SessionEvidence,
  touchedFiles: string[],
): NonNullable<PreflightEvidence['riskSources']>['sessionMemory'] {
  return {
    kind: 'remembered-session',
    id: session.id,
    touchedFiles,
    totalTouchedFiles: session.touchedFiles.length,
    eventCount: session.eventCount,
    note: 'remembered session context is useful for agent handoff, but it may include older files that are not part of the current Git/worktree diff.',
    ...(session.touchedFiles.length > MAX_PREFLIGHT_EVIDENCE_FILES ? { truncated: true } : {}),
  };
}

function touchedHotspotEvidence(
  hotspots: HotspotReport | null,
  session: SessionEvidence,
): NonNullable<PreflightEvidence['hotspots']>['touched'] {
  if (hotspots?.available !== true) return [];
  return hotspots.hotspots
    .filter((hotspot) => session.touchedFiles.includes(hotspot.relativePath))
    .slice(0, MAX_PREFLIGHT_EVIDENCE_FILES)
    .map((hotspot) => ({ file: hotspot.relativePath, riskScore: hotspot.riskScore }));
}

function pluginEvidence(
  issues: Issue[],
  enabled: boolean,
): NonNullable<PreflightEvidence['plugins']> {
  const pluginIssues = issues.filter((issue) => issue.id.startsWith('plugin:'));
  return {
    enabled,
    errorIssues: pluginIssues.filter((issue) => issue.severity === 'error').length,
    warningIssues: pluginIssues.filter((issue) => issue.severity === 'warning').length,
  };
}

function supplyChainEvidence(issues: Issue[]): NonNullable<PreflightEvidence['supplyChain']> {
  const supplyChainIssues = issues.filter((issue) => issue.category === 'supply-chain');
  return {
    errorIssues: supplyChainIssues.filter((issue) => issue.severity === 'error').length,
    warningIssues: supplyChainIssues.filter((issue) => issue.severity === 'warning').length,
  };
}

function coordinationEvidence(
  coordination: CoordinationSummary,
): NonNullable<PreflightEvidence['coordination']> {
  const evidence = coordination.evidence;
  return {
    available: true,
    readiness: coordination.readiness,
    worktreeCount: coordination.worktreeCount,
    collisions: {
      high: coordination.collisions.high,
      medium: coordination.collisions.medium,
    },
    contendedClaims: coordination.claims.contendedTargets,
    ...(evidence
      ? {
          commandPath: evidence.commandPath,
          command: evidence.command,
          localOnly: evidence.localOnly,
          currentWorktree: evidence.currentWorktree,
          validationWorkflow: evidence.validationWorkflow,
          sessionSeparation: evidence.sessionSeparation,
        }
      : {}),
  };
}
