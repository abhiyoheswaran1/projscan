import { isReadyAction } from './startExecutionPlan.js';
import { isPlaceholder } from './startIntentTargets.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type {
  StartAdoptionGap,
  StartMissionControlStatus,
  StartReport,
  StartUnresolvedInput,
} from '../types/start.js';
import type { WorkplanReport } from '../types/workplan.js';

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

export function headlineForStatus(status: StartMissionControlStatus, label: string): string {
  if (status === 'blocked') return `Blocked: ${label}`;
  if (status === 'needs_setup') return `Set up first: ${label}`;
  if (status === 'needs_attention') return `Proceed carefully: ${label}`;
  return `Next move: ${label}`;
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
