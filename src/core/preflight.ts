import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { loadSession } from './session.js';
import { pluginsEnabled } from './plugins.js';
import { computeCoordination, type CoordinationSummary } from './coordination.js';
import { policyIssueReasons } from './preflightIssueReasons.js';
import { changedFileReasons } from './preflightChangedFileReasons.js';
import { buildRequiredChecks } from './preflightRequiredChecks.js';
import { buildReleaseScaleEvidence } from './preflightReleaseScale.js';
import { reviewReasons } from './preflightReviewReasons.js';
import { buildEvidence, MAX_PREFLIGHT_EVIDENCE_FILES } from './preflightEvidence.js';
import { contextReasons } from './preflightContextReasons.js';
import {
  buildSuggestedActions,
  buildToolCalls,
} from './preflightSuggestedActions.js';
import {
  safeReviewEvidence,
  type PreflightReviewEvidence,
} from './preflightReviewEvidence.js';
import { getChangedFiles, type ChangedFilesResult } from '../utils/changedFiles.js';
import { loadConfig, applyConfigToIssues } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type {
  FileEntry,
  HealthScore,
  HotspotReport,
  Issue,
  PreflightMode,
  PreflightReason,
  PreflightReleaseScaleEvidence,
  PreflightReport,
  PreflightVerdict,
} from '../types.js';

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

const DEFAULT_MAX_CHANGED_FILES = 50;

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
  const review = await safeReviewEvidence(rootPath, mode, options);
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
    changedFiles.files.length > MAX_PREFLIGHT_EVIDENCE_FILES ||
    (evidence.hotspots?.touched.length ?? 0) > MAX_PREFLIGHT_EVIDENCE_FILES;
  const report: PreflightReport = {
    schemaVersion: 1,
    mode,
    verdict,
    summary: '',
    reasons,
    evidence,
    requiredChecks: buildRequiredChecks({
      mode,
      health,
      changedFiles,
      review,
      supplyChain,
      releaseScale,
    }),
    suggestedNextActions: buildSuggestedActions({ reasons, mode, changedFiles }),
    toolCalls: buildToolCalls({ reasons, mode, changedFiles }),
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
  reasons.push(...policyIssueReasons(input.issues));
  reasons.push(...changedFileReasons(input));
  if (input.releaseScale?.detected) {
    reasons.push({
      severity: 'warning',
      source: 'release',
      message: input.releaseScale.explanation,
      tool: 'projscan_review',
    });
  }

  reasons.push(...reviewReasons(input));
  reasons.push(...contextReasons(input));
  return reasons;
}
