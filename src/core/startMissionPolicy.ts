import type { AgentWorkflowRecipe } from './adoption.js';
import type {
  StartRisk,
  StartWorkflowRecommendation,
} from '../types/start.js';
import type { QualityScorecardVerdict } from '../types/qualityScorecard.js';
import type { WorkplanMode, WorkplanReport } from '../types/workplan.js';

export { headlineForStatus, missionReadyActions, missionStatus, missionUnresolvedInputs } from './startMissionInputStatusPolicy.js';
export { actionFromWorkflow, missionActionPlan, routedWhyNow } from './startMissionRoutingPolicy.js';
export { combineRisks } from './startMissionRiskPolicy.js';
export { dedupeActions, missionGuardrails, missionProofCommands } from './startMissionProofPolicy.js';

export function chooseWorkflow(
  mode: WorkplanMode,
  recipes: AgentWorkflowRecipe[],
): StartWorkflowRecommendation {
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
  if (mode === 'before_commit') return 'before_handoff';
  if (mode === 'before_merge') return 'pre_merge';
  if (mode === 'hardening') return 'bug_hunt';
  if (mode === 'refactor') return 'before_edit';
  return 'before_edit';
}

export function summarize(
  mode: WorkplanMode,
  workplan: WorkplanReport,
  qualityRisks: number,
  adoptionGaps: number,
  fixFirstTitle?: string,
  qualityVerdict?: QualityScorecardVerdict,
  topRisks: StartRisk[] = [],
): string {
  const qualityLabel =
    topRisks.some(isPriorityRisk)
      ? 'ranked risk item(s)'
      : qualityVerdict === 'excellent' || qualityVerdict === 'healthy'
      ? 'quality watch item(s)'
      : 'quality risk(s)';
  return `start: ${mode} recommends ${fixFirstTitle ?? workplan.tasks[0]?.title ?? 'preserving the baseline'} with ${qualityRisks} ${qualityLabel} and ${adoptionGaps} adoption gap(s)`;
}

function isPriorityRisk(risk: StartRisk): boolean {
  return risk.priority === 'p0' || risk.priority === 'p1';
}
