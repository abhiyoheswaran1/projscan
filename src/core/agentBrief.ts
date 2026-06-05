import { analyzeHotspots } from './hotspotAnalyzer.js';
import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import { computeDataflow } from './dataflow.js';
import { buildSemanticGraph } from './semanticGraph.js';
import { collectIssues } from './issueEngine.js';
import { scanRepository } from './repositoryScanner.js';
import { buildRiskNow } from './sessionResources.js';
import { computeCoordination, coordinationHints as toCoordinationHints, type CoordinationSummary } from './coordination.js';
import { applyConfigToIssues, loadConfig } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type {
  AgentBriefGuardrail,
  AgentBriefIntent,
  AgentBriefItem,
  AgentBriefReport,
  FileEntry,
  FileHotspot,
  GraphEvidenceSummary,
  HotspotReport,
  Issue,
  PreflightSuggestedAction,
  SessionConflict,
  WorkplanPriority,
} from '../types.js';

export interface ComputeAgentBriefOptions {
  intent?: AgentBriefIntent;
  maxItems?: number;
}

const DEFAULT_MAX_ITEMS = 6;

export async function computeAgentBrief(
  rootPath: string,
  options: ComputeAgentBriefOptions = {},
): Promise<AgentBriefReport> {
  const intent = normalizeIntent(options.intent);
  const maxItems = normalizeMax(options.maxItems);
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
  const issues = applyConfigToIssues(await collectIssues(rootPath, scan.files), configResult.config);
  const health = calculateScore(issues);
  const [riskNow, hotspots, graphContext, coordination] = await Promise.all([
    safeRiskNow(rootPath),
    safeHotspots(rootPath, scan.files, issues, maxItems),
    safeGraphContext(rootPath, scan.files),
    safeCoordination(rootPath),
  ]);
  const allFocus = rankFocus([
    ...issues.slice(0, maxItems * 2).map(issueToFocus),
    ...riskNow.conflicts.map(conflictToFocus),
    ...(hotspots.available ? hotspots.hotspots.map(hotspotToFocus) : []),
  ]);
  const focus = allFocus.length > 0 ? allFocus.slice(0, maxItems) : [baselineFocus(intent)];
  const guardrails = buildGuardrails(intent);

  return {
    schemaVersion: 1,
    intent,
    summary: summarize(intent, focus, health),
    health,
    context: {
      totalFiles: scan.totalFiles,
      totalDirectories: scan.totalDirectories,
      topDirectories: topDirectories(scan.files),
      touchedFiles: riskNow.touchedFiles.slice(0, 12),
      conflicts: riskNow.conflicts.length,
      coordinationHints: [...riskNow.coordinationHints, ...swarmCoordinationHints(coordination)],
      ...(graphContext ? { graph: graphContext } : {}),
    },
    focus,
    guardrails,
    suggestedNextActions: suggestedActions(focus, guardrails),
    ...(allFocus.length > focus.length || riskNow.touchedFiles.length > 12 ? { truncated: true } : {}),
  };
}

async function safeGraphContext(rootPath: string, files: FileEntry[]): Promise<GraphEvidenceSummary | undefined> {
  try {
    const graph = await buildCodeGraph(rootPath, files);
    const semantic = buildSemanticGraph(graph, { maxNodes: 5_000, maxEdges: 10_000 });
    const dataflow = computeDataflow(graph, { sources: [], sinks: [] });
    return {
      schemaVersion: 1,
      totalFunctions: semantic.metrics.totalFunctions,
      totalPackages: semantic.metrics.totalPackages,
      totalCallEdges: semantic.edges.filter((edge) => edge.kind === 'calls').length,
      dataflowRisks: dataflow.riskCount,
      topPackages: topPackagesByImporters(graph),
    };
  } catch {
    return undefined;
  }
}

function topPackagesByImporters(graph: CodeGraph): string[] {
  return [...graph.packageImporters.entries()]
    .map(([name, importers]) => ({ name, count: importers.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((entry) => entry.name);
}

async function safeCoordination(rootPath: string): Promise<CoordinationSummary | null> {
  try {
    return await computeCoordination(rootPath);
  } catch {
    return null;
  }
}

/**
 * Fold the swarm coordination read into a single structured brief hint. Empty
 * when coordination is unavailable or clear (the common single-worktree case),
 * so the brief is unchanged unless there's real cross-worktree signal.
 */
function swarmCoordinationHints(summary: CoordinationSummary | null): Array<{
  id: 'swarm-coordination';
  label: string;
  message: string;
  command: string;
}> {
  if (!summary) return [];
  const hints = toCoordinationHints(summary);
  if (hints.length === 0) return [];
  return [
    {
      id: 'swarm-coordination',
      label: 'Swarm coordination',
      message: hints.join(' '),
      command: 'projscan coordinate --format json',
    },
  ];
}

async function safeRiskNow(rootPath: string): Promise<Pick<Awaited<ReturnType<typeof buildRiskNow>>, 'touchedFiles' | 'conflicts' | 'coordinationHints'>> {
  try {
    return await buildRiskNow(rootPath);
  } catch {
    return {
      touchedFiles: [],
      conflicts: [],
      coordinationHints: [
        {
          id: 'current-worktree-check',
          label: 'Separate current worktree evidence from session memory',
          message: 'Run preflight to see current Git/worktree risk; remembered session touches may include older agent context.',
          command: 'projscan preflight --mode before_edit --format json',
        },
      ],
    };
  }
}

async function safeHotspots(
  rootPath: string,
  files: Parameters<typeof analyzeHotspots>[1],
  issues: Issue[],
  limit: number,
): Promise<HotspotReport> {
  try {
    return await analyzeHotspots(rootPath, files, issues, { limit });
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
      window: { since: null, commitsScanned: 0 },
      hotspots: [],
      totalFilesRanked: 0,
    };
  }
}

function issueToFocus(issue: Issue): AgentBriefItem {
  const files = issueFiles(issue);
  return {
    id: `ab-issue-${issue.id}`,
    priority: severityPriority(issue.severity),
    title: issue.title,
    why: issue.description,
    files,
    commands: ['projscan doctor --format json', `projscan explain-issue ${issue.id} --format json`],
  };
}

function conflictToFocus(conflict: SessionConflict, index: number): AgentBriefItem {
  return {
    id: `ab-conflict-${index + 1}`,
    priority: conflict.severity === 'error' ? 'p0' : 'p1',
    title: 'Resolve coordination conflict',
    why: conflict.message,
    files: conflict.files,
    commands: ['projscan session touched --format json', 'projscan agent-brief --format json'],
  };
}

function hotspotToFocus(hotspot: FileHotspot): AgentBriefItem {
  return {
    id: `ab-hotspot-${slug(hotspot.relativePath)}`,
    priority: hotspot.riskScore >= 70 ? 'p0' : hotspot.riskScore >= 30 ? 'p1' : 'p2',
    title: `Inspect hotspot ${hotspot.relativePath}`,
    why: hotspot.reasons[0] ?? `Risk score ${Math.round(hotspot.riskScore)}`,
    files: [hotspot.relativePath],
    commands: [`projscan file ${hotspot.relativePath} --format json`, 'projscan hotspots --format json'],
  };
}

function baselineFocus(intent: AgentBriefIntent): AgentBriefItem {
  return {
    id: 'ab-baseline',
    priority: 'p2',
    title: 'Keep the clean baseline reproducible',
    why: `No immediate focus targets were found for ${intent}. Preserve the baseline with repeatable checks before handoff.`,
    files: [],
    commands: ['projscan doctor --format json', 'projscan preflight --mode before_edit --format json'],
  };
}

function buildGuardrails(intent: AgentBriefIntent): AgentBriefGuardrail[] {
  return [
    {
      id: 'ab-guardrail-health',
      label: 'Health check',
      reason: 'Start with the fastest repo-wide signal before editing.',
      command: 'projscan doctor --format json',
    },
    {
      id: 'ab-guardrail-preflight',
      label: 'Preflight check',
      reason: 'Confirm the current session is safe for the selected intent.',
      command: intent === 'release'
        ? 'projscan preflight --mode before_merge --format json'
        : 'projscan preflight --mode before_edit --format json',
    },
    {
      id: 'ab-guardrail-tests',
      label: 'Regression check',
      reason: 'Keep the brief tied to repeatable verification.',
      command: intent === 'release' ? 'projscan regression-plan --level focused --format json' : 'npm test',
    },
  ];
}

function rankFocus(items: AgentBriefItem[]): AgentBriefItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.id.localeCompare(b.id));
}

function suggestedActions(
  focus: AgentBriefItem[],
  guardrails: AgentBriefGuardrail[],
): PreflightSuggestedAction[] {
  return [
    ...focus.slice(0, 5).map((item) => ({ label: item.title, command: item.commands[0] })),
    ...guardrails.map((guardrail) => ({ label: guardrail.label, command: guardrail.command })),
  ].slice(0, 10);
}

function summarize(intent: AgentBriefIntent, focus: AgentBriefItem[], health: ReturnType<typeof calculateScore>): string {
  return `agent brief: ${intent} has ${focus.length} focus item(s), health ${health.grade} (${health.score})`;
}

function topDirectories(files: Array<{ directory: string }>): Array<{ directory: string; files: number }> {
  const counts = new Map<string, number>();
  for (const file of files) {
    const dir = file.directory || '.';
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([directory, count]) => ({ directory, files: count }))
    .sort((a, b) => b.files - a.files || a.directory.localeCompare(b.directory))
    .slice(0, 8);
}

function issueFiles(issue: Issue): string[] {
  return [...new Set((issue.locations ?? []).map((location) => location.file).filter(Boolean))];
}

function normalizeIntent(value: AgentBriefIntent | undefined): AgentBriefIntent {
  if (value === 'bug_hunt' || value === 'release' || value === 'refactor' || value === 'hardening') return value;
  return 'next_agent';
}

function normalizeMax(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_ITEMS;
  return Math.max(1, Math.min(20, Math.floor(value)));
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

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';
}
