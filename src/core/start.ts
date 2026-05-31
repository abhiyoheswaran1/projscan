import { computeFirstRunDiagnostics, getWorkflowRecipes, type AgentWorkflowRecipe } from './adoption.js';
import { fixFirstFromStartRisk } from './fixFirst.js';
import { computeQualityScorecard } from './qualityScorecard.js';
import { buildWorkplanHandoff, computeWorkplan, isWorkplanMode } from './workplan.js';
import type {
  PreflightSuggestedAction,
  QualityScorecardRisk,
  StartAdoptionGap,
  StartAdoptionLoop,
  StartReport,
  StartRisk,
  StartWorkflowRecommendation,
  WorkplanMode,
  WorkplanReport,
  WorkplanTopRisk,
} from '../types.js';

export interface ComputeStartOptions {
  mode?: WorkplanMode;
  maxTasks?: number;
  maxRisks?: number;
  includeHandoff?: boolean;
}

const DEFAULT_MAX_TASKS = 5;
const DEFAULT_MAX_RISKS = 5;

export async function computeStartReport(
  rootPath: string,
  options: ComputeStartOptions = {},
): Promise<StartReport> {
  const mode = normalizeMode(options.mode);
  const maxTasks = normalizeLimit(options.maxTasks, DEFAULT_MAX_TASKS, 12);
  const maxRisks = normalizeLimit(options.maxRisks, DEFAULT_MAX_RISKS, 12);
  const [setup, workplan, quality] = await Promise.all([
    computeFirstRunDiagnostics(rootPath),
    computeWorkplan(rootPath, { mode, maxTasks }),
    computeQualityScorecard(rootPath, { maxRisks }),
  ]);
  const workflow = chooseWorkflow(mode, getWorkflowRecipes().recipes);
  const topRisks = combineRisks(workplan, quality.topRisks, maxRisks);
  const fixFirst = workplan.fixFirst ?? fixFirstFromStartRisk(topRisks[0]);
  const adoptionGaps = setup.diagnostics
    .filter((diagnostic) => diagnostic.status !== 'pass')
    .map((diagnostic): StartAdoptionGap => ({
      id: diagnostic.id,
      status: diagnostic.status as StartAdoptionGap['status'],
      title: diagnostic.label,
      summary: diagnostic.summary,
      ...(diagnostic.command ? { command: diagnostic.command } : {}),
    }));
  const adoptionLoop = buildAdoptionLoop();
  const nextActions = dedupeActions([
    ...workflow.commands.map((command) => ({ label: `Run ${workflow.name}`, command })),
    ...adoptionLoop.nextCommands.map((command) => ({ label: 'Keep using projscan every PR', command })),
    ...workplan.suggestedNextActions,
    ...quality.suggestedNextActions,
  ]);
  const report: StartReport = {
    schemaVersion: 1,
    readOnly: true,
    rootPath,
    mode,
    summary: summarize(mode, workplan, quality.topRisks.length, adoptionGaps.length, fixFirst?.title),
    setup: {
      overall: setup.overall,
      diagnostics: setup.diagnostics,
    },
    recommendedWorkflow: workflow,
    evidence: {
      workplanVerdict: workplan.verdict,
      workplanSummary: workplan.summary,
      qualityVerdict: quality.verdict,
      qualitySummary: quality.summary,
      healthScore: quality.health.score,
      mcpReady: setup.diagnostics.find((diagnostic) => diagnostic.id === 'mcp-startup')?.status === 'pass',
    },
    topRisks,
    ...(fixFirst ? { fixFirst } : {}),
    adoptionGaps,
    adoptionLoop,
    nextActions,
    ...(options.includeHandoff ? { handoff: buildWorkplanHandoff(workplan) } : {}),
    ...(workplan.truncated === true || quality.truncated === true ? { truncated: true } : {}),
  };
  return report;
}

function buildAdoptionLoop(): StartAdoptionLoop {
  return {
    cadence: 'every_pr',
    why: 'projscan is useful when it becomes PR muscle memory: comment, fix first, route owners, capture feedback, and compare against the last good baseline.',
    metrics: [
      {
        id: 'first_pr_useful',
        label: 'First PR usefulness',
        target: 'Reviewer says the PR comment saved 10-20 minutes or identified one missed risk.',
        command: 'projscan evidence-pack --pr-comment',
      },
      {
        id: 'manual_review_rate',
        label: 'Manual review rate',
        target: 'Most uncertain findings stay caution/manual review; actual blocks stay rare and concrete.',
        command: 'projscan preflight --mode before_merge --format json',
      },
      {
        id: 'repeat_use_commands',
        label: 'Repeat-use commands',
        target: 'Every PR has evidence-pack, preflight, and owner routing before merge.',
        command: 'projscan start --mode before_merge --format json',
      },
      {
        id: 'market_validation_feedback',
        label: 'Market validation feedback',
        target: 'At least three real reviewers confirm usefulness, minutes saved, prevented risk, and false-positive/noisy-rule status.',
        command: 'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
      },
    ],
    nextCommands: [
      'projscan evidence-pack --pr-comment',
      'projscan preflight --mode before_merge --format json',
      'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
      'projscan dogfood --repo <path-to-repo> --format json',
    ],
  };
}

function normalizeMode(value: WorkplanMode | undefined): WorkplanMode {
  if (typeof value === 'string' && isWorkplanMode(value)) return value;
  return 'before_edit';
}

function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function chooseWorkflow(mode: WorkplanMode, recipes: AgentWorkflowRecipe[]): StartWorkflowRecommendation {
  const id = recipeIdForMode(mode);
  const recipe = recipes.find((entry) => entry.id === id) ?? recipes[0];
  return {
    id: recipe.id,
    name: recipe.name,
    why: `${recipe.useWhen} ${recipe.outcome}`,
    commands: recipe.commands,
    mcpTools: recipe.mcpTools,
  };
}

function recipeIdForMode(mode: WorkplanMode): string {
  if (mode === 'bug_hunt') return 'bug_hunt';
  if (mode === 'release') return 'release_approval';
  if (mode === 'before_commit' || mode === 'before_merge') return 'pre_merge';
  if (mode === 'hardening') return 'bug_hunt';
  if (mode === 'refactor') return 'before_edit';
  return 'before_edit';
}

function combineRisks(
  workplan: WorkplanReport,
  qualityRisks: QualityScorecardRisk[],
  maxRisks: number,
): StartRisk[] {
  const fromWorkplan = workplan.topRisks.map(workplanRiskToStartRisk);
  const fromQuality = qualityRisks.map(qualityRiskToStartRisk);
  const risks = dedupeRisks([...fromWorkplan, ...fromQuality]).slice(0, maxRisks);
  if (risks.length > 0) return risks;
  return [
    {
      id: 'start-baseline',
      priority: 'p2',
      title: 'Preserve the clean baseline',
      source: 'baseline',
      files: [],
      command: 'projscan start --format json',
    },
  ];
}

function workplanRiskToStartRisk(risk: WorkplanTopRisk, index: number): StartRisk {
  return {
    id: `start-workplan-${index + 1}`,
    priority: risk.priority,
    title: risk.message,
    source: risk.source,
    files: risk.file ? [risk.file] : [],
    command: risk.tool === 'projscan_review' ? 'projscan review --format json' : 'projscan preflight --format json',
  };
}

function qualityRiskToStartRisk(risk: QualityScorecardRisk): StartRisk {
  return {
    id: `start-quality-${risk.id}`,
    priority: risk.priority,
    title: risk.title,
    source: risk.source,
    files: risk.files,
    command: risk.command,
  };
}

function dedupeRisks(risks: StartRisk[]): StartRisk[] {
  const seen = new Set<string>();
  const result: StartRisk[] = [];
  for (const risk of risks) {
    const key = `${risk.title}:${risk.files.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(risk);
  }
  return result;
}

function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const result: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = `${action.label}:${action.command ?? ''}:${action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result.slice(0, 12);
}

function summarize(
  mode: WorkplanMode,
  workplan: WorkplanReport,
  qualityRisks: number,
  adoptionGaps: number,
  fixFirstTitle?: string,
): string {
  return `start: ${mode} recommends ${fixFirstTitle ?? workplan.tasks[0]?.title ?? 'preserving the baseline'} with ${qualityRisks} quality risk(s) and ${adoptionGaps} adoption gap(s)`;
}
