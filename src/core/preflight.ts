import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { computeReview } from './review.js';
import { loadSession } from './session.js';
import { PLUGIN_PREVIEW_FLAG, pluginsEnabled } from './plugins.js';
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
  PreflightReport,
  PreflightRequiredCheck,
  PreflightSuggestedAction,
  PreflightVerdict,
  ReviewReport,
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

interface PreflightReviewEvidence {
  available: boolean;
  verdict?: ReviewReport['verdict'];
  summary?: string;
  reason?: string;
  newTaintFlows?: number;
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
  const reasons = buildPreflightReasons({
    mode,
    issues,
    changedFiles,
    health,
    session,
    hotspots,
    review,
    maxChangedFiles: options.maxChangedFiles ?? DEFAULT_MAX_CHANGED_FILES,
  });
  const verdict = decidePreflightVerdict(reasons);
  const evidence = buildEvidence({
    health,
    changedFiles,
    session,
    hotspots,
    issues,
    pluginsEnabledForRun: options.enablePlugins === true || pluginsEnabled(),
    review,
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
    requiredChecks: buildRequiredChecks(mode, health, changedFiles, review),
    suggestedNextActions: buildSuggestedActions(reasons, mode, changedFiles),
    toolCalls: buildToolCalls(reasons, mode, changedFiles),
    ...(truncated ? { truncated: true } : {}),
  };
  return { ...report, summary: summarizePreflight(report) };
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
  return `${report.verdict}: ${report.reasons[0].message}`;
}

async function collectIssuesWithPluginOption(
  rootPath: string,
  files: FileEntry[],
  enablePlugins?: boolean,
): Promise<Issue[]> {
  if (enablePlugins !== true) return collectIssues(rootPath, files);
  const previous = process.env[PLUGIN_PREVIEW_FLAG];
  process.env[PLUGIN_PREVIEW_FLAG] = '1';
  try {
    return await collectIssues(rootPath, files);
  } finally {
    if (previous === undefined) delete process.env[PLUGIN_PREVIEW_FLAG];
    else process.env[PLUGIN_PREVIEW_FLAG] = previous;
  }
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
    };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
    };
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
  maxChangedFiles: number;
}): PreflightReason[] {
  const reasons: PreflightReason[] = [];
  const changedSet = new Set(input.changedFiles.files);
  const changedOnly = input.mode !== 'before_edit' && input.changedFiles.available;

  for (const issue of input.issues) {
    if (!issue.id.startsWith('plugin:')) continue;
    reasons.push({
      severity: issue.severity,
      source: 'plugin',
      issueId: issue.id,
      file: firstIssueFile(issue),
      message: `${issue.severity === 'error' ? 'Plugin policy blocks' : 'Plugin policy flags'} ${issue.id}: ${issue.title}`,
      tool: 'projscan_plugin',
    });
  }

  if (changedOnly) {
    const changedIssues = input.issues.filter((issue) => issueTouchesChangedFile(issue, changedSet));
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
        severity: 'error',
        source: 'review',
        message: 'Review verdict is block',
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
      ? input.hotspots.hotspots.filter((hotspot) => touched.has(hotspot.relativePath) && hotspot.riskScore >= 40)
      : [];
  for (const hotspot of hotspotTouches.slice(0, 3)) {
    reasons.push({
      severity: 'warning',
      source: 'hotspots',
      file: hotspot.relativePath,
      message: `Touched file overlaps high-risk hotspot ${hotspot.relativePath} (risk ${hotspot.riskScore})`,
      tool: 'projscan_hotspots',
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

  return reasons;
}

function buildEvidence(input: {
  health: HealthScore;
  changedFiles: PreflightChangedFiles;
  session: PreflightSessionEvidence;
  hotspots: HotspotReport | null;
  issues: Issue[];
  pluginsEnabledForRun: boolean;
  review: PreflightReviewEvidence;
}): PreflightEvidence {
  const pluginIssues = input.issues.filter((issue) => issue.id.startsWith('plugin:'));
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
      id: input.session.id,
      touchedFiles: sessionTouchedFiles,
      totalTouchedFiles: input.session.touchedFiles.length,
      eventCount: input.session.eventCount,
      ...(input.session.touchedFiles.length > MAX_EVIDENCE_FILES ? { truncated: true } : {}),
    },
    hotspots: { touched },
    plugins: {
      enabled: input.pluginsEnabledForRun,
      errorIssues: pluginIssues.filter((issue) => issue.severity === 'error').length,
      warningIssues: pluginIssues.filter((issue) => issue.severity === 'warning').length,
    },
  };
}

function buildRequiredChecks(
  mode: PreflightMode,
  health: HealthScore,
  changedFiles: PreflightChangedFiles,
  review: PreflightReviewEvidence,
): PreflightRequiredCheck[] {
  const checks: PreflightRequiredCheck[] = [
    {
      name: 'health',
      status: health.errors > 0 ? 'fail' : health.warnings > 0 ? 'warn' : 'pass',
      reason: `${health.errors} error(s), ${health.warnings} warning(s), ${health.infos} info`,
    },
  ];
  checks.push({
    name: 'changed-files',
    status: changedFiles.available ? 'pass' : 'unavailable',
    reason: changedFiles.available
      ? `${changedFiles.count} changed file(s)`
      : changedFiles.reason ?? 'changed-file detection unavailable',
  });
  checks.push({
    name: 'review',
    status:
      mode === 'before_edit'
        ? 'unavailable'
        : !review.available
          ? 'unavailable'
          : review.verdict === 'block'
            ? 'fail'
            : review.verdict === 'review'
              ? 'warn'
              : 'pass',
    reason:
      mode === 'before_edit'
        ? 'review is not required before edits'
        : review.available
          ? review.summary ?? review.verdict
          : review.reason ?? 'review unavailable',
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
  if (reasons.some((reason) => reason.source === 'doctor' || reason.source === 'plugin')) {
    actions.push({
      label: 'Inspect health issues and plugin policy findings',
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
    });
  }
  if (reasons.some((reason) => reason.source === 'hotspots')) {
    actions.push({
      label: 'Inspect touched hotspots',
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
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
  return (issue.locations ?? []).some((location) => location.file && changedFiles.has(location.file));
}

function firstIssueFile(issue: Issue): string | undefined {
  return issue.locations?.find((location) => location.file)?.file;
}
