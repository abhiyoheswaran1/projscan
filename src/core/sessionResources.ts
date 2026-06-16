import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { scanRepository } from './repositoryScanner.js';
import { loadSession, type Session } from './session.js';
import type {
  Issue,
  PreflightSuggestedAction,
  RiskNowResource,
  SessionConflict,
  SessionCoordinationHint,
  SessionHandoff,
  SessionResourceSummary,
} from '../types.js';

const MAX_TOUCHED_FILES = 50;
const MAX_RECENT_ISSUES = 10;
const MAX_CONFLICTS = 25;

export async function buildSessionSummary(rootPath: string): Promise<SessionResourceSummary> {
  const { session } = await loadSession(rootPath);
  const touchedFiles = orderedTouchedFiles(session);
  const signals = await loadProjectSignals(rootPath);
  const touchedSet = new Set(touchedFiles);
  const recentIssues = signals.issues
    .filter((issue) => issueTouchesFiles(issue, touchedSet))
    .slice(0, MAX_RECENT_ISSUES);
  const highRiskTouchedFiles =
    signals.hotspots
      ?.filter((hotspot) => touchedSet.has(hotspot.file) && hotspot.riskScore >= 40)
      .slice(0, MAX_TOUCHED_FILES) ?? [];
  const staleSignals = signals.staleSignals;
  if (touchedFiles.length === 0) staleSignals.push('session has no touched files');

  return {
    schemaVersion: 1,
    sessionId: session.id,
    touchedFiles: touchedFiles.slice(0, MAX_TOUCHED_FILES),
    recentIssues,
    highRiskTouchedFiles,
    staleSignals,
    coordinationHints: buildCoordinationHints(touchedFiles, []),
    ...(touchedFiles.length > MAX_TOUCHED_FILES ? { truncated: true } : {}),
  };
}

export async function buildHandoff(rootPath: string): Promise<SessionHandoff> {
  const summary = await buildSessionSummary(rootPath);
  const riskNow = await buildRiskNow(rootPath);
  return {
    schemaVersion: 1,
    summary,
    remainingRisks: riskNow.conflicts,
    suggestedNextActions: buildHandoffActions(riskNow.conflicts),
    coordinationHints: buildCoordinationHints(summary.touchedFiles, riskNow.conflicts),
    avoidRepeating: buildAvoidRepeating(summary),
  };
}

export async function buildRiskNow(rootPath: string): Promise<RiskNowResource> {
  const { session } = await loadSession(rootPath);
  const touchedFiles = orderedTouchedFiles(session);
  const signals = await loadProjectSignals(rootPath, { includeGraph: true });
  const conflicts = [
    ...detectSessionConflicts(touchedFiles, signals.graph),
    ...detectHotspotConflicts(touchedFiles, signals.hotspots ?? []),
  ].slice(0, MAX_CONFLICTS);

  return {
    schemaVersion: 1,
    conflicts,
    touchedFiles: touchedFiles.slice(0, MAX_TOUCHED_FILES),
    coordinationHints: buildCoordinationHints(touchedFiles, conflicts),
    ...(touchedFiles.length > MAX_TOUCHED_FILES || conflicts.length >= MAX_CONFLICTS
      ? { truncated: true }
      : {}),
  };
}

export function detectSessionConflicts(files: string[], graph?: CodeGraph): SessionConflict[] {
  const conflicts: SessionConflict[] = [];
  const counts = new Map<string, number>();
  for (const file of files) counts.set(file, (counts.get(file) ?? 0) + 1);
  for (const [file, count] of counts) {
    if (count > 1) {
      conflicts.push({
        kind: 'same-file',
        files: [file],
        message: `Remembered session context touched ${file} ${count} times`,
        severity: 'warning',
      });
    }
  }

  const unique = [...counts.keys()];
  const sameWorkspace = firstSameWorkspacePair(unique);
  if (sameWorkspace) {
    conflicts.push({
      kind: 'same-workspace',
      files: sameWorkspace,
      message: `Remembered session context includes ${sameWorkspace[0]} and ${sameWorkspace[1]} in the same package or top-level area`,
      severity: 'warning',
    });
  }

  if (graph) {
    const importRelated = firstImportRelatedPair(unique, graph);
    if (importRelated) {
      conflicts.push({
        kind: 'import-related',
        files: importRelated,
        message: `Remembered session context includes ${importRelated[0]} and ${importRelated[1]} connected by the local import graph`,
        severity: 'warning',
      });
    }
  }

  return conflicts;
}

function orderedTouchedFiles(session: Session): string[] {
  return Object.values(session.touchedFiles)
    .sort((a, b) => {
      const byTime = Date.parse(b.lastTouchedAt) - Date.parse(a.lastTouchedAt);
      return byTime !== 0 ? byTime : a.file.localeCompare(b.file);
    })
    .map((touch) => touch.file);
}

async function loadProjectSignals(
  rootPath: string,
  options: { includeGraph?: boolean } = {},
): Promise<{
  issues: Issue[];
  hotspots: Array<{ file: string; riskScore: number }> | null;
  graph?: CodeGraph;
  staleSignals: string[];
}> {
  const staleSignals: string[] = [];
  try {
    const scan = await scanRepository(rootPath);
    const issues = await collectIssues(rootPath, scan.files);
    let graph: CodeGraph | undefined;
    if (options.includeGraph) {
      try {
        graph = await buildCodeGraph(rootPath, scan.files);
      } catch (err) {
        staleSignals.push(`graph unavailable: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const hotspotReport = await analyzeHotspots(rootPath, scan.files, issues, { limit: 50, graph });
    const hotspots = hotspotReport.available
      ? hotspotReport.hotspots.map((hotspot) => ({
          file: hotspot.relativePath,
          riskScore: hotspot.riskScore,
        }))
      : null;
    if (!hotspotReport.available) {
      staleSignals.push(`hotspots unavailable: ${hotspotReport.reason ?? 'unknown reason'}`);
    }
    return { issues, hotspots, graph, staleSignals };
  } catch (err) {
    return {
      issues: [],
      hotspots: null,
      staleSignals: [
        `project signals unavailable: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}

function issueTouchesFiles(issue: Issue, files: Set<string>): boolean {
  return (issue.locations ?? []).some((location) => location.file && files.has(location.file));
}

function firstSameWorkspacePair(files: string[]): [string, string] | null {
  const byWorkspace = new Map<string, string>();
  for (const file of files) {
    const workspace = workspaceKey(file);
    const previous = byWorkspace.get(workspace);
    if (previous && previous !== file) return [previous, file];
    byWorkspace.set(workspace, file);
  }
  return null;
}

function workspaceKey(file: string): string {
  const parts = file.split('/').filter(Boolean);
  if (parts[0] === 'packages' && parts[1]) return `${parts[0]}/${parts[1]}`;
  if (parts[0] === 'apps' && parts[1]) return `${parts[0]}/${parts[1]}`;
  return parts[0] ?? '.';
}

function firstImportRelatedPair(files: string[], graph: CodeGraph): [string, string] | null {
  const touched = new Set(files);
  for (const target of files) {
    const importers = graph.localImporters.get(target);
    if (!importers) continue;
    for (const importer of importers) {
      if (touched.has(importer)) return [importer, target];
    }
  }
  return null;
}

function detectHotspotConflicts(
  touchedFiles: string[],
  hotspots: Array<{ file: string; riskScore: number }>,
): SessionConflict[] {
  const touched = new Set(touchedFiles);
  return hotspots
    .filter((hotspot) => touched.has(hotspot.file) && hotspot.riskScore >= 40)
    .slice(0, 5)
    .map((hotspot) => ({
      kind: 'hotspot-overlap' as const,
      files: [hotspot.file],
      message: `Remembered session context touched high-risk hotspot ${hotspot.file} (risk ${hotspot.riskScore})`,
      severity: 'warning' as const,
    }));
}

function buildCoordinationHints(
  touchedFiles: string[],
  conflicts: SessionConflict[],
): SessionCoordinationHint[] {
  const hints: SessionCoordinationHint[] = [
    {
      id: 'current-worktree-check',
      label: 'Separate current worktree evidence from session memory',
      message:
        'Run preflight to see current Git/worktree risk; remembered session touches may include older agent context.',
      command: 'projscan preflight --mode before_edit --format json',
    },
  ];
  if (touchedFiles.length > 0) {
    hints.push({
      id: 'remembered-session-context',
      label: 'Review remembered session touches',
      message: `${touchedFiles.length} touched file(s) come from remembered session context, not necessarily the current Git diff.`,
      command: 'projscan session touched --format json',
    });
  }
  if (conflicts.length > 0) {
    hints.push({
      id: 'resolve-conflicts',
      label: 'Resolve coordination conflicts before parallel edits continue',
      message: `${conflicts.length} coordination conflict(s) need an owner or preflight check before handoff.`,
      command: 'projscan agent-brief --intent next_agent --format json',
    });
  }
  return hints;
}

function buildHandoffActions(conflicts: SessionConflict[]): PreflightSuggestedAction[] {
  const actions: PreflightSuggestedAction[] = [
    {
      label: 'Run an agent safety preflight before continuing',
      tool: 'projscan_preflight',
      command: 'projscan preflight --format json',
    },
  ];
  if (conflicts.some((conflict) => conflict.kind === 'import-related')) {
    actions.push({
      label: 'Inspect import impact for the related touched files',
      tool: 'projscan_impact',
    });
  }
  if (conflicts.some((conflict) => conflict.kind === 'hotspot-overlap')) {
    actions.push({
      label: 'Inspect remembered session hotspots',
      tool: 'projscan_session',
      command: 'projscan session touched --format json',
    });
  }
  return actions;
}

function buildAvoidRepeating(summary: SessionResourceSummary): string[] {
  if (summary.touchedFiles.length === 0)
    return ['No touched files have been recorded in this session.'];
  return summary.touchedFiles
    .slice(0, 5)
    .map((file) => `Do not re-scan ${file} without a new reason.`);
}
