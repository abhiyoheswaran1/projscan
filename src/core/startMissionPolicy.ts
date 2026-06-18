import type { AgentWorkflowRecipe } from './adoption.js';
import { prioritizeStartHarnessHints } from './startHarness.js';
import { isPlaceholder } from './startIntentTargets.js';
import { actionPlanFromRoute } from './startRouteActions.js';
import { isReadyAction } from './startExecutionPlan.js';
import { isRunnableCommand, uniqueStrings } from './startResume.js';
import {
  actionFromWorkplan,
  isPreflightAction,
  preflightModeForMission,
} from './startSuccessCriteria.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type {
  StartAdoptionGap,
  StartMissionControlStatus,
  StartReport,
  StartRisk,
  StartRoutedIntent,
  StartUnresolvedInput,
  StartWorkflowRecommendation,
} from '../types/start.js';
import type { QualityScorecardRisk, QualityScorecardVerdict } from '../types/qualityScorecard.js';
import type { SessionCoordinationHint } from '../types/session.js';
import type { WorkplanMode, WorkplanReport, WorkplanTopRisk } from '../types/workplan.js';

export function routedWhyNow(
  route: StartRoutedIntent,
  actionPlan: PreflightSuggestedAction[],
): string {
  if (route.tool === 'projscan_impact' && actionPlan[0]?.tool === 'projscan_search') {
    return `Intent matched "${route.intent}", but the target is a phrase, so search first and then run ${route.tool} on the exact symbol or file.`;
  }
  if (route.tool === 'projscan_fix_suggest' && actionPlan[0]?.tool === 'projscan_doctor') {
    return `Intent matched "${route.intent}", but no issue id was named, so run projscan_doctor first and then run ${route.tool} on the selected issue.`;
  }
  if (route.tool === 'projscan_explain_issue' && actionPlan[0]?.tool === 'projscan_doctor') {
    return `Intent matched "${route.intent}", but no issue id was named, so run projscan_doctor first and then run ${route.tool} on the selected issue.`;
  }
  if (route.tool === 'projscan_upgrade' && actionPlan[0]?.tool === 'projscan_outdated') {
    return `Intent matched "${route.intent}", but no package was named, so run projscan_outdated first and then run ${route.tool} on the selected package.`;
  }
  return `Intent matched "${route.intent}", so start with ${route.tool} before broader workflow commands.`;
}

export function missionStatus(
  setupOverall: StartReport['setup']['overall'],
  verdict: WorkplanReport['verdict'],
  adoptionGaps: StartAdoptionGap[],
): StartMissionControlStatus {
  if (setupOverall === 'fail' || verdict === 'block') return 'blocked';
  if (adoptionGaps.some((gap) => gap.status === 'fail')) return 'needs_setup';
  if (
    setupOverall === 'warn' ||
    verdict === 'caution' ||
    adoptionGaps.some((gap) => gap.status === 'warn')
  )
    return 'needs_attention';
  return 'ready';
}

export function missionActionPlan(
  mode: WorkplanMode,
  intent: string | undefined,
  route: StartRoutedIntent | undefined,
  fixFirst: StartReport['fixFirst'],
  workplan: WorkplanReport,
  workflow: StartWorkflowRecommendation,
): PreflightSuggestedAction[] {
  if (route?.tool === 'projscan_release_train' && mode !== 'release') {
    return [
      {
        label: `Use projscan_workplan for ${intent ?? mode}`,
        command: `projscan workplan --mode ${mode} --format json`,
        tool: 'projscan_workplan',
        args: { mode },
      },
    ];
  }
  if (route && intent) return actionPlanFromRoute(mode, intent, route);
  const fallback =
    actionFromFixFirst(fixFirst) ?? actionFromWorkplan(workplan) ?? actionFromWorkflow(workflow);
  return [fallback];
}

export function missionUnresolvedInputs(
  actionPlan: PreflightSuggestedAction[],
): StartUnresolvedInput[] {
  const sourceAction = actionPlan[0]?.label ?? 'the previous action';
  const unresolved: StartUnresolvedInput[] = [];
  for (const action of actionPlan.slice(1)) {
    if (!action.args) continue;
    for (const [name, value] of Object.entries(action.args)) {
      if (typeof value !== 'string' || !isPlaceholder(value)) continue;
      unresolved.push({
        name,
        placeholder: value,
        sourceAction,
        instruction: placeholderInstruction(name, value),
      });
    }
  }
  return dedupeUnresolvedInputs(unresolved);
}

export function missionReadyActions(
  actionPlan: PreflightSuggestedAction[],
): PreflightSuggestedAction[] {
  return actionPlan.filter(isReadyAction);
}

function placeholderInstruction(name: string, placeholder: string): string {
  if (name === 'symbol')
    return `Replace ${placeholder} with an exported symbol returned by the search step.`;
  if (name === 'file')
    return `Replace ${placeholder} with a file path returned by the search step.`;
  if (name === 'issue_id')
    return `Replace ${placeholder} with an issue id from projscan doctor or projscan analyze.`;
  if (name === 'package')
    return `Replace ${placeholder} with a package name from projscan outdated or projscan dependencies.`;
  if (name === 'target')
    return `Replace ${placeholder} with the file, directory, or symbol to claim.`;
  if (name === 'agent') return `Replace ${placeholder} with the agent name holding the claim.`;
  if (name === 'report_scope')
    return `Replace ${placeholder} with one or more comma-separated repo-relative paths to include in the shared evidence.`;
  return `Replace ${placeholder} with the ${name} value produced by the previous step.`;
}

function dedupeUnresolvedInputs(inputs: StartUnresolvedInput[]): StartUnresolvedInput[] {
  const seen = new Set<string>();
  const result: StartUnresolvedInput[] = [];
  for (const input of inputs) {
    const key = `${input.name}:${input.placeholder}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(input);
  }
  return result;
}

function actionFromFixFirst(
  fixFirst: StartReport['fixFirst'],
): PreflightSuggestedAction | undefined {
  if (!fixFirst) return undefined;
  return {
    label: fixFirst.title,
    command: fixFirst.commands[0],
  };
}

export function actionFromWorkflow(
  workflow: StartWorkflowRecommendation,
): PreflightSuggestedAction {
  return {
    label: `Run ${workflow.name}`,
    command: workflow.commands[0] ?? 'projscan start --format json',
    tool: workflow.mcpTools[0],
  };
}

export function headlineForStatus(status: StartMissionControlStatus, label: string): string {
  if (status === 'blocked') return `Blocked: ${label}`;
  if (status === 'needs_setup') return `Set up first: ${label}`;
  if (status === 'needs_attention') return `Proceed carefully: ${label}`;
  return `Next move: ${label}`;
}

export function missionGuardrails(
  mode: WorkplanMode,
  coordinationHints: SessionCoordinationHint[],
  primaryAction: PreflightSuggestedAction,
): PreflightSuggestedAction[] {
  const preflightMode = preflightModeForMission(mode);
  const guardrails: PreflightSuggestedAction[] = [
    {
      label: 'Verify the repo map before handoff',
      command: 'projscan understand --view verify --format json',
      tool: 'projscan_understand',
    },
  ];
  if (!isPreflightAction(primaryAction)) {
    guardrails.unshift({
      label: 'Check the safety gate before editing',
      command: `projscan preflight --mode ${preflightMode} --format json`,
      tool: 'projscan_preflight',
    });
  }
  for (const hint of prioritizeStartHarnessHints(coordinationHints)) {
    guardrails.push({
      label: hint.label,
      command: hint.command,
    });
  }
  return dedupeActions(guardrails).slice(0, 4);
}

export function missionProofCommands(
  mode: WorkplanMode,
  workplan: WorkplanReport,
  guardrails: PreflightSuggestedAction[],
  actionPlan: PreflightSuggestedAction[],
): string[] {
  const primaryAction = actionPlan[0] ?? actionFromWorkplan(workplan);
  const commands = uniqueStrings([
    ...actionPlan.map((action) => action.command ?? ''),
    ...(isPreflightAction(primaryAction)
      ? []
      : [`projscan preflight --mode ${preflightModeForMission(mode)} --format json`]),
    ...guardrails
      .map((action) => action.command)
      .filter((command): command is string => typeof command === 'string'),
    ...workplan.tasks.flatMap((task) => task.verification.commands),
  ]).filter(isRunnableCommand);
  const proofCommands = releaseCandidateProofCommands(mode, commands);
  if (!isPreflightAction(primaryAction)) return proofCommands.slice(0, 8);
  return proofCommands
    .filter((command, index) => index === 0 || !command.startsWith('projscan preflight '))
    .slice(0, 8);
}

function releaseCandidateProofCommands(mode: WorkplanMode, commands: string[]): string[] {
  if (mode !== 'release') return commands;
  const localWebsitePrompt = 'projscan evidence-pack --website-prompt --format json';
  const localOnly = commands.filter(
    (command) =>
      command !== 'npm view projscan version' &&
      command !== 'gh release view vX.Y.Z --json assets',
  );
  const withWebsitePrompt = localOnly.includes(localWebsitePrompt)
    ? localOnly
    : [...localOnly, localWebsitePrompt];
  const priority = [
    'projscan release-train --format json',
    'projscan preflight --mode before_merge --format json',
    'projscan understand --view verify --format json',
    'npm exec agentloop -- status',
    'npm exec agentflight -- verify',
    'npm run release:check',
    localWebsitePrompt,
  ];
  return uniqueStrings([
    ...priority.filter((command) => withWebsitePrompt.includes(command)),
    ...withWebsitePrompt,
  ]);
}

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

export function combineRisks(
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
    title: startRiskTitle(risk),
    source: risk.source,
    files: risk.file ? [risk.file] : [],
    command:
      risk.tool === 'projscan_review'
        ? 'projscan review --format json'
        : 'projscan preflight --format json',
  };
}

function startRiskTitle(risk: WorkplanTopRisk): string {
  if (risk.source !== 'release') return risk.message;
  if (/large handoff review risk|manual review sign-off/iu.test(risk.message)) {
    return 'Manual review sign-off required for large handoff risk';
  }
  if (/large platform release risk|manual release sign-off/iu.test(risk.message)) {
    return 'Manual release sign-off required for large platform release risk';
  }
  return risk.message;
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

export function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const result: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = action.command
      ? `command:${action.command}`
      : `action:${action.label}:${action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result.slice(0, 12);
}

export function summarize(
  mode: WorkplanMode,
  workplan: WorkplanReport,
  qualityRisks: number,
  adoptionGaps: number,
  fixFirstTitle?: string,
  qualityVerdict?: QualityScorecardVerdict,
): string {
  const qualityLabel =
    qualityVerdict === 'excellent' || qualityVerdict === 'healthy'
      ? 'quality watch item(s)'
      : 'quality risk(s)';
  return `start: ${mode} recommends ${fixFirstTitle ?? workplan.tasks[0]?.title ?? 'preserving the baseline'} with ${qualityRisks} ${qualityLabel} and ${adoptionGaps} adoption gap(s)`;
}
