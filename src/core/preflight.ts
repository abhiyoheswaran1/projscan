import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { computeReview } from './review.js';
import { loadSession } from './session.js';
import { pluginsEnabled } from './plugins.js';
import { computeCoordination, type CoordinationSummary } from './coordination.js';
import { policyIssueReasons } from './preflightIssueReasons.js';
import { getChangedFiles, type ChangedFilesResult } from '../utils/changedFiles.js';
import { loadConfig, applyConfigToIssues } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type {
  FileEntry,
  HealthScore,
  HotspotReport,
  Issue,
  PreflightEvidence,
  PreflightMode,
  PreflightReason,
  PreflightReleaseScaleEvidence,
  PreflightReport,
  PreflightRequiredCheck,
  PreflightSuggestedAction,
  PreflightVerdict,
} from '../types.js';
import type { ReviewReport } from '../types/review.js';

export interface ComputePreflightOptions {
  mode?: PreflightMode;
  baseRef?: string;
  headRef?: string;
  maxChangedFiles?: number;
  enablePlugins?: boolean;
}

interface PreflightChangedFiles {
  available: boolean;
  count: number;
  files: string[];
  baseRef: string | null;
  reason?: string;
}

interface PreflightSessionEvidence {
  id: string;
  touchedFiles: string[];
  eventCount: number;
}

interface PreflightReviewEvidence {
  available: boolean;
  verdict?: ReviewReport['verdict'];
  summary?: string;
  reason?: string;
  newTaintFlows?: number;
  newDataflowRisks?: number;
}

const DEFAULT_MAX_CHANGED_FILES = 50;
const MAX_EVIDENCE_FILES = 40;

export async function computePreflight(
  rootPath: string,
  options: ComputePreflightOptions = {},
): Promise<PreflightReport> {
  const mode = options.mode ?? 'before_edit';
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
  const issues = applyConfigToIssues(
    await collectIssuesWithPluginOption(rootPath, scan.files, options.enablePlugins),
    configResult.config,
  );
  const health = calculateScore(issues);
  const changedFiles = await safeChangedFiles(rootPath, mode, options.baseRef);
  const session = await safeSession(rootPath);
  const hotspots = await safeHotspots(rootPath, scan.files, issues);
  const review = await safeReview(rootPath, mode, options);
  const coordination = await safeCoordination(rootPath, options.baseRef);
  const maxChangedFiles = options.maxChangedFiles ?? DEFAULT_MAX_CHANGED_FILES;
  const supplyChain = countSupplyChainIssues(issues);
  const releaseScale = buildReleaseScaleEvidence({
    mode,
    issues,
    changedFiles,
    health,
    review,
    supplyChain,
    maxChangedFiles,
  });
  const reasons = buildPreflightReasons({
    mode,
    issues,
    changedFiles,
    health,
    session,
    hotspots,
    review,
    releaseScale,
    coordination,
    maxChangedFiles,
  });
  const verdict = decidePreflightVerdict(reasons);
  const evidence = buildEvidence({
    health,
    changedFiles,
    session,
    hotspots,
    issues,
    pluginsEnabledForRun: pluginsEnabled(),
    review,
    releaseScale,
    coordination,
  });
  const truncated =
    evidence.session?.truncated === true ||
    changedFiles.files.length > MAX_EVIDENCE_FILES ||
    (evidence.hotspots?.touched.length ?? 0) > MAX_EVIDENCE_FILES;
  const report: PreflightReport = {
    schemaVersion: 1,
    mode,
    verdict,
    summary: '',
    reasons,
    evidence,
    requiredChecks: buildRequiredChecks(
      mode,
      health,
      changedFiles,
      review,
      supplyChain,
      releaseScale,
    ),
    suggestedNextActions: buildSuggestedActions(reasons, mode, changedFiles),
    toolCalls: buildToolCalls(reasons, mode, changedFiles),
    ...(truncated ? { truncated: true } : {}),
  };
  return { ...report, summary: summarizePreflight(report) };
}

function countSupplyChainIssues(issues: Issue[]): { errorIssues: number; warningIssues: number } {
  const supplyChainIssues = issues.filter((issue) => issue.category === 'supply-chain');
  return {
    errorIssues: supplyChainIssues.filter((issue) => issue.severity === 'error').length,
    warningIssues: supplyChainIssues.filter((issue) => issue.severity === 'warning').length,
  };
}

export function decidePreflightVerdict(reasons: PreflightReason[]): PreflightVerdict {
  if (reasons.some((reason) => reason.severity === 'error')) return 'block';
  if (reasons.some((reason) => reason.severity === 'warning')) return 'caution';
  return 'proceed';
}

export function summarizePreflight(report: PreflightReport): string {
  if (report.reasons.length === 0) {
    return `${report.verdict}: no blocking or cautionary signals found`;
  }
  if (report.evidence.releaseScale?.detected) {
    return `${report.verdict}: manual release sign-off recommended for large platform release risk`;
  }
  return `${report.verdict}: ${report.reasons[0].message}`;
}

async function collectIssuesWithPluginOption(
  rootPath: string,
  files: FileEntry[],
  _enablePlugins?: boolean,
): Promise<Issue[]> {
  return collectIssues(rootPath, files);
}

async function safeChangedFiles(
  rootPath: string,
  mode: PreflightMode,
  baseRef?: string,
): Promise<PreflightChangedFiles> {
  if (mode === 'before_edit') {
    return {
      available: false,
      count: 0,
      files: [],
      baseRef: null,
      reason: 'changed-file detection is not required before edits',
    };
  }
  try {
    const result: ChangedFilesResult = await getChangedFiles(rootPath, baseRef);
    return {
      available: result.available,
      count: result.files.length,
      files: result.files,
      baseRef: result.baseRef,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  } catch (err) {
    return {
      available: false,
      count: 0,
      files: [],
      baseRef: null,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function safeSession(rootPath: string): Promise<PreflightSessionEvidence> {
  const { session } = await loadSession(rootPath);
  const touchedFiles = Object.values(session.touchedFiles)
    .sort((a, b) => {
      const byTime = Date.parse(b.lastTouchedAt) - Date.parse(a.lastTouchedAt);
      return byTime !== 0 ? byTime : a.file.localeCompare(b.file);
    })
    .map((touch) => touch.file);
  return {
    id: session.id,
    touchedFiles,
    eventCount: session.events.length,
  };
}

async function safeHotspots(
  rootPath: string,
  files: FileEntry[],
  issues: Issue[],
): Promise<HotspotReport | null> {
  try {
    return await analyzeHotspots(rootPath, files, issues, { limit: 20 });
  } catch {
    return null;
  }
}

async function safeReview(
  rootPath: string,
  mode: PreflightMode,
  options: ComputePreflightOptions,
): Promise<PreflightReviewEvidence> {
  if (mode === 'before_edit') {
    return { available: false, reason: 'review is not required before edits' };
  }
  try {
    const report = await computeReview(rootPath, {
      base: options.baseRef,
      head: options.headRef,
    });
    return {
      available: report.available,
      verdict: report.available ? report.verdict : undefined,
      summary: report.available ? report.summary.join('; ') : undefined,
      reason: report.available ? undefined : report.reason,
      newTaintFlows: report.available ? report.newTaintFlows.length : undefined,
      newDataflowRisks: report.available ? report.newDataflowRisks.length : undefined,
    };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Coordination evidence for preflight; null when no real cross-worktree read. */
async function safeCoordination(
  rootPath: string,
  baseRef?: string,
): Promise<CoordinationSummary | null> {
  try {
    const summary = await computeCoordination(rootPath, baseRef ? { baseRef } : {});
    return summary.available ? summary : null;
  } catch {
    return null;
  }
}

function buildPreflightReasons(input: {
  mode: PreflightMode;
  issues: Issue[];
  changedFiles: PreflightChangedFiles;
  health: HealthScore;
  session: PreflightSessionEvidence;
  hotspots: HotspotReport | null;
  review: PreflightReviewEvidence;
  releaseScale: PreflightReleaseScaleEvidence | null;
  coordination: CoordinationSummary | null;
  maxChangedFiles: number;
}): PreflightReason[] {
  const reasons: PreflightReason[] = [];
  const changedSet = new Set(input.changedFiles.files);
  const changedOnly = input.mode !== 'before_edit' && input.changedFiles.available;
  reasons.push(...policyIssueReasons(input.issues));

  if (changedOnly) {
    const changedIssues = input.issues.filter((issue) =>
      issueTouchesChangedFile(issue, changedSet),
    );
    const error = changedIssues.find((issue) => issue.severity === 'error');
    const warning = changedIssues.find((issue) => issue.severity === 'warning');
    if (error) {
      reasons.push({
        severity: 'error',
        source: 'doctor',
        issueId: error.id,
        file: firstIssueFile(error),
        message: `Health error on changed file: ${error.title}`,
        tool: 'projscan_doctor',
      });
    } else if (warning) {
      reasons.push({
        severity: 'warning',
        source: 'doctor',
        issueId: warning.id,
        file: firstIssueFile(warning),
        message: `Health warning on changed file: ${warning.title}`,
        tool: 'projscan_doctor',
      });
    }
  } else if (input.mode !== 'before_edit' && !input.changedFiles.available) {
    reasons.push({
      severity: 'warning',
      source: 'changed-files',
      message: `Changed files unavailable: ${input.changedFiles.reason ?? 'unknown reason'}`,
      tool: 'projscan_review',
    });
  }

  if (
    input.mode !== 'before_edit' &&
    input.changedFiles.available &&
    input.changedFiles.count > input.maxChangedFiles
  ) {
    reasons.push({
      severity: 'warning',
      source: 'changed-files',
      message: `${input.changedFiles.count} changed files exceeds the preflight threshold of ${input.maxChangedFiles}`,
      tool: 'projscan_review',
    });
  }
  if (input.releaseScale?.detected) {
    reasons.push({
      severity: 'warning',
      source: 'release',
      message: input.releaseScale.explanation,
      tool: 'projscan_review',
    });
  }

  if (input.review.available) {
    if ((input.review.newTaintFlows ?? 0) > 0) {
      reasons.push({
        severity: 'error',
        source: 'taint',
        message: `${input.review.newTaintFlows} new taint flow(s) found in review`,
        tool: 'projscan_review',
      });
    }
    if (input.review.verdict === 'block') {
      reasons.push({
        severity: input.releaseScale?.detected ? 'warning' : 'error',
        source: 'review',
        message: formatReviewBlockMessage(input.review, input.releaseScale),
        tool: 'projscan_review',
      });
    } else if (input.review.verdict === 'review') {
      reasons.push({
        severity: 'warning',
        source: 'review',
        message: 'Review verdict requires careful review',
        tool: 'projscan_review',
      });
    }
  } else if (input.mode !== 'before_edit') {
    reasons.push({
      severity: 'warning',
      source: 'review',
      message: `Review unavailable: ${input.review.reason ?? 'unknown reason'}`,
      tool: 'projscan_review',
    });
  }

  const touched = new Set(input.session.touchedFiles);
  const hotspotTouches =
    input.hotspots?.available === true
      ? input.hotspots.hotspots.filter(
          (hotspot) => touched.has(hotspot.relativePath) && hotspot.riskScore >= 40,
        )
      : [];
  for (const hotspot of hotspotTouches.slice(0, 3)) {
    reasons.push({
      severity: 'warning',
      source: 'session',
      file: hotspot.relativePath,
      message: `Remembered session context touched high-risk hotspot ${hotspot.relativePath} (risk ${hotspot.riskScore})`,
      tool: 'projscan_session',
    });
  }

  if (input.health.errors > 0 && input.mode === 'before_merge' && !changedOnly) {
    reasons.push({
      severity: 'warning',
      source: 'doctor',
      message: `${input.health.errors} project health error(s) exist; changed-file scoping was unavailable`,
      tool: 'projscan_doctor',
    });
  }

  // Swarm coordination — advisory only: a cross-worktree collision raises
  // caution (warning), never a hard block. No reason when clear/unavailable.
  if (input.coordination?.available) {
    const { collisions, claims, worktreeCount, readiness } = input.coordination;
    if (readiness === 'conflicted') {
      const contended =
        claims.contendedTargets > 0 ? `, ${claims.contendedTargets} contended claim(s)` : '';
      reasons.push({
        severity: 'warning',
        source: 'coordination',
        message: `Swarm collision risk across ${worktreeCount} in-flight worktrees: ${collisions.high} high / ${collisions.medium} medium${contended}. Run \`projscan coordinate\` before merging.`,
        tool: 'projscan_coordinate',
      });
    } else if (readiness === 'caution') {
      reasons.push({
        severity: 'info',
        source: 'coordination',
        message: `Dependency overlap with another in-flight worktree (${collisions.medium} medium). Run \`projscan coordinate\`.`,
        tool: 'projscan_coordinate',
      });
    }
  }

  return reasons;
}

function buildReleaseScaleEvidence(input: {
  mode: PreflightMode;
  issues: Issue[];
  changedFiles: PreflightChangedFiles;
  health: HealthScore;
  review: PreflightReviewEvidence;
  supplyChain: { errorIssues: number; warningIssues: number };
  maxChangedFiles: number;
}): PreflightReleaseScaleEvidence | null {
  if (input.mode === 'before_edit') return null;
  if (!input.changedFiles.available) return null;

  const concreteBlockers = concretePreflightBlockers(input);
  if (concreteBlockers.length > 0) return null;

  const reviewSummary = input.review.summary;
  const changedFileThresholdExceeded = input.changedFiles.count > input.maxChangedFiles;
  const reviewScaleOnly =
    input.review.available &&
    input.review.verdict === 'block' &&
    isScaleComplexityReviewBlock(reviewSummary);
  if (!changedFileThresholdExceeded && !reviewScaleOnly) return null;

  const triggers = [
    changedFileThresholdExceeded
      ? `${input.changedFiles.count} changed files exceeds the preflight threshold of ${input.maxChangedFiles}`
      : undefined,
    reviewScaleOnly && reviewSummary
      ? `review signal: ${trimTrailingSentencePunctuation(reviewSummary)}`
      : undefined,
  ].filter(Boolean);

  const reviewBlocksOnScale = input.review.available && input.review.verdict === 'block';
  const explanationTail = reviewBlocksOnScale
    ? 'Review blocks on scale/complexity rather than new taint, dataflow, health, plugin, or supply-chain defects.'
    : 'This is a configured scale threshold/manual review signal, not a concrete taint, dataflow, health, plugin, or supply-chain defect.';
  const signoffTail = reviewSummary?.toLowerCase().includes('manual release sign-off')
    ? ''
    : ' Treat this as a manual release sign-off gate.';

  return {
    detected: true,
    changedFiles: input.changedFiles.count,
    threshold: input.maxChangedFiles,
    ...(input.review.verdict ? { reviewVerdict: input.review.verdict } : {}),
    ...(reviewSummary ? { reviewSummary } : {}),
    concreteBlockers,
    explanation: `Large platform release risk: ${triggers.join('; ')}. ${explanationTail}${signoffTail}`,
  };
}

function isScaleComplexityReviewBlock(summary: string | undefined): boolean {
  if (!summary?.includes('Maximum changed-file risk score')) return false;
  return !summary.includes('new import cycle');
}

function trimTrailingSentencePunctuation(value: string): string {
  return value.trim().replace(/[.]+$/u, '');
}

function concretePreflightBlockers(input: {
  issues: Issue[];
  health: HealthScore;
  review: PreflightReviewEvidence;
  supplyChain: { errorIssues: number; warningIssues: number };
}): string[] {
  const blockers: string[] = [];
  if (input.health.errors > 0) blockers.push('health');
  if (input.supplyChain.errorIssues > 0) blockers.push('supply-chain');
  if (input.issues.some((issue) => issue.id.startsWith('plugin:') && issue.severity === 'error'))
    blockers.push('plugin');
  if ((input.review.newTaintFlows ?? 0) > 0) blockers.push('taint');
  if ((input.review.newDataflowRisks ?? 0) > 0) blockers.push('dataflow');
  return blockers;
}

function formatReviewBlockMessage(
  review: PreflightReviewEvidence,
  releaseScale: PreflightReleaseScaleEvidence | null,
): string {
  if (releaseScale?.detected) {
    return `Review verdict is block due to scale/complexity risk: ${review.summary ?? 'review requires manual sign-off'}`;
  }
  return 'Review verdict is block';
}

function formatReviewCheckReason(
  review: PreflightReviewEvidence,
  releaseScale?: PreflightReleaseScaleEvidence | null,
): string {
  if (review.verdict === 'block' && releaseScale?.detected) {
    return `scale/complexity: ${review.summary ?? review.verdict}`;
  }
  return review.summary ?? review.verdict ?? 'review unavailable';
}

function buildEvidence(input: {
  health: HealthScore;
  changedFiles: PreflightChangedFiles;
  session: PreflightSessionEvidence;
  hotspots: HotspotReport | null;
  issues: Issue[];
  pluginsEnabledForRun: boolean;
  review: PreflightReviewEvidence;
  releaseScale: PreflightReleaseScaleEvidence | null;
  coordination: CoordinationSummary | null;
}): PreflightEvidence {
  const pluginIssues = input.issues.filter((issue) => issue.id.startsWith('plugin:'));
  const supplyChainIssues = input.issues.filter((issue) => issue.category === 'supply-chain');
  const touched =
    input.hotspots?.available === true
      ? input.hotspots.hotspots
          .filter((hotspot) => input.session.touchedFiles.includes(hotspot.relativePath))
          .slice(0, MAX_EVIDENCE_FILES)
          .map((hotspot) => ({ file: hotspot.relativePath, riskScore: hotspot.riskScore }))
      : [];
  const sessionTouchedFiles = input.session.touchedFiles.slice(0, MAX_EVIDENCE_FILES);
  const changedEvidenceFiles = input.changedFiles.files.slice(0, MAX_EVIDENCE_FILES);
  return {
    health: {
      score: input.health.score,
      grade: input.health.grade,
      errors: input.health.errors,
      warnings: input.health.warnings,
      infos: input.health.infos,
    },
    changedFiles: {
      available: input.changedFiles.available,
      count: input.changedFiles.count,
      files: changedEvidenceFiles,
      ...(input.changedFiles.reason ? { reason: input.changedFiles.reason } : {}),
    },
    review: {
      available: input.review.available,
      ...(input.review.verdict ? { verdict: input.review.verdict } : {}),
      ...(input.review.summary ? { summary: input.review.summary } : {}),
      ...(input.review.reason ? { reason: input.review.reason } : {}),
    },
    session: {
      kind: 'remembered-session',
      id: input.session.id,
      touchedFiles: sessionTouchedFiles,
      totalTouchedFiles: input.session.touchedFiles.length,
      eventCount: input.session.eventCount,
      note: 'remembered session context comes from previous projscan tool results, explicit touches, and MCP file-watch events. It is not the same as current Git/worktree changes.',
      ...(input.session.touchedFiles.length > MAX_EVIDENCE_FILES ? { truncated: true } : {}),
    },
    riskSources: {
      currentWorktree: {
        kind: 'current-worktree',
        available: input.changedFiles.available,
        count: input.changedFiles.count,
        files: changedEvidenceFiles,
        baseRef: input.changedFiles.baseRef,
        ...(input.changedFiles.reason ? { reason: input.changedFiles.reason } : {}),
      },
      sessionMemory: {
        kind: 'remembered-session',
        id: input.session.id,
        touchedFiles: sessionTouchedFiles,
        totalTouchedFiles: input.session.touchedFiles.length,
        eventCount: input.session.eventCount,
        note: 'remembered session context is useful for agent handoff, but it may include older files that are not part of the current Git/worktree diff.',
        ...(input.session.touchedFiles.length > MAX_EVIDENCE_FILES ? { truncated: true } : {}),
      },
    },
    hotspots: { touched },
    plugins: {
      enabled: input.pluginsEnabledForRun,
      errorIssues: pluginIssues.filter((issue) => issue.severity === 'error').length,
      warningIssues: pluginIssues.filter((issue) => issue.severity === 'warning').length,
    },
    supplyChain: {
      errorIssues: supplyChainIssues.filter((issue) => issue.severity === 'error').length,
      warningIssues: supplyChainIssues.filter((issue) => issue.severity === 'warning').length,
    },
    ...(input.releaseScale ? { releaseScale: input.releaseScale } : {}),
    ...(input.coordination
      ? {
          coordination: {
            available: true,
            readiness: input.coordination.readiness,
            worktreeCount: input.coordination.worktreeCount,
            collisions: {
              high: input.coordination.collisions.high,
              medium: input.coordination.collisions.medium,
            },
            contendedClaims: input.coordination.claims.contendedTargets,
          },
        }
      : {}),
  };
}

function buildRequiredChecks(
  mode: PreflightMode,
  health: HealthScore,
  changedFiles: PreflightChangedFiles,
  review: PreflightReviewEvidence,
  supplyChain?: { errorIssues: number; warningIssues: number },
  releaseScale?: PreflightReleaseScaleEvidence | null,
): PreflightRequiredCheck[] {
  const checks: PreflightRequiredCheck[] = [
    {
      name: 'health',
      status: health.errors > 0 ? 'fail' : health.warnings > 0 ? 'warn' : 'pass',
      reason: `${health.errors} error(s), ${health.warnings} warning(s), ${health.infos} info`,
    },
  ];
  checks.push({
    name: 'supply-chain',
    status:
      (supplyChain?.errorIssues ?? 0) > 0
        ? 'fail'
        : (supplyChain?.warningIssues ?? 0) > 0
          ? 'warn'
          : 'pass',
    reason: `${supplyChain?.errorIssues ?? 0} error(s), ${supplyChain?.warningIssues ?? 0} warning(s)`,
  });
  checks.push({
    name: 'changed-files',
    status: changedFiles.available ? 'pass' : 'unavailable',
    reason: changedFiles.available
      ? `${changedFiles.count} changed file(s)`
      : (changedFiles.reason ?? 'changed-file detection unavailable'),
  });
  checks.push({
    name: 'review',
    status:
      mode === 'before_edit'
        ? 'unavailable'
        : !review.available
          ? 'unavailable'
          : review.verdict === 'block'
            ? releaseScale?.detected
              ? 'warn'
              : 'fail'
            : review.verdict === 'review'
              ? 'warn'
              : 'pass',
    reason:
      mode === 'before_edit'
        ? 'review is not required before edits'
        : review.available
          ? formatReviewCheckReason(review, releaseScale)
          : (review.reason ?? 'review unavailable'),
  });
  return checks;
}

function buildSuggestedActions(
  reasons: PreflightReason[],
  mode: PreflightMode,
  changedFiles: PreflightChangedFiles,
): PreflightSuggestedAction[] {
  if (reasons.length === 0) return [];
  const actions: PreflightSuggestedAction[] = [];
  if (reasons.some((reason) => reason.source === 'review' || reason.source === 'taint')) {
    actions.push({
      label: 'Inspect the full review before continuing',
      command: 'projscan review --format json',
      tool: 'projscan_review',
    });
  }
  if (
    reasons.some(
      (reason) =>
        reason.source === 'doctor' ||
        reason.source === 'plugin' ||
        reason.source === 'supply-chain',
    )
  ) {
    actions.push({
      label: 'Inspect health, plugin policy, and supply-chain findings',
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
    });
  }
  if (reasons.some((reason) => reason.source === 'hotspots' || reason.source === 'session')) {
    actions.push({
      label: 'Inspect remembered session hotspots',
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
    });
  }
  if (mode !== 'before_edit' && !changedFiles.available) {
    actions.push({
      label: 'Run preflight with an explicit base ref',
      command: 'projscan preflight --base-ref main --format json',
    });
  }
  return dedupeActions(actions);
}

function buildToolCalls(
  reasons: PreflightReason[],
  mode: PreflightMode,
  changedFiles: PreflightChangedFiles,
): PreflightSuggestedAction[] {
  return buildSuggestedActions(reasons, mode, changedFiles).map((action) => ({
    label: action.label,
    ...(action.tool ? { tool: action.tool } : {}),
    ...(action.args ? { args: action.args } : {}),
  }));
}

function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const out: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = `${action.label}:${action.command ?? action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

function issueTouchesChangedFile(issue: Issue, changedFiles: Set<string>): boolean {
  return (issue.locations ?? []).some(
    (location) => location.file && changedFiles.has(location.file),
  );
}

function firstIssueFile(issue: Issue): string | undefined {
  return issue.locations?.find((location) => location.file)?.file;
}
