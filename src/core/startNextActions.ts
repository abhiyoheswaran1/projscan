import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { QualityScorecardReport } from '../types/qualityScorecard.js';
import type { StartReport } from '../types/start.js';
import type { WorkplanReport } from '../types/workplan.js';
import { dedupeActions } from './startMissionPolicy.js';

export interface BuildStartNextActionsInput {
  missionControl: StartReport['missionControl'];
  firstTenMinutes: StartReport['firstTenMinutes'];
  workflow: StartReport['recommendedWorkflow'];
  adoptionLoop: StartReport['adoptionLoop'];
  workplan: WorkplanReport;
  quality: QualityScorecardReport;
}

export function buildStartNextActions(input: BuildStartNextActionsInput): PreflightSuggestedAction[] {
  const { missionControl, firstTenMinutes, workflow, adoptionLoop, workplan, quality } = input;
  return dedupeActions([
    missionControl.primaryAction,
    ...firstTenMinutes.commands.map((step) => ({
      label: `First 10 minutes: ${step.label}`,
      command: step.command,
    })),
    ...workflow.commands.map((command) => ({ label: `Run ${workflow.name}`, command })),
    ...(adoptionLoop?.nextCommands ?? []).map((command) => ({
      label: 'Keep using projscan every PR',
      command,
    })),
    ...workplan.suggestedNextActions,
    ...quality.suggestedNextActions,
  ]);
}
