import { getWorkflowRecipes } from './adoption.js';
import { fixFirstFromStartRisk } from './fixFirst.js';
import { buildFirstTenMinutes } from './onboarding.js';
import { buildAdoptionLoop } from './startAdoptionLoop.js';
import { buildStartAdoptionGaps } from './startAdoptionGaps.js';
import { buildStartCoordinationHints } from './startEvidence.js';
import type { loadStartInputs } from './startInputs.js';
import { buildMissionControl } from './startMissionControl.js';
import { chooseWorkflow, combineRisks } from './startMissionPolicy.js';
import { buildStartNextActions } from './startNextActions.js';
import type { StartReport } from '../types/start.js';
import type { WorkplanMode } from '../types/workplan.js';

type LoadedStartInputs = Awaited<ReturnType<typeof loadStartInputs>>;

export interface BuildStartReportContextInput extends LoadedStartInputs {
  mode: WorkplanMode;
  intent?: string;
  maxRisks: number;
}

export interface StartReportContext {
  workflow: StartReport['recommendedWorkflow'];
  firstTenMinutes: StartReport['firstTenMinutes'];
  missionControl: StartReport['missionControl'];
  coordinationHints: StartReport['coordinationHints'];
  topRisks: StartReport['topRisks'];
  fixFirst: StartReport['fixFirst'];
  adoptionGaps: StartReport['adoptionGaps'];
  adoptionLoop: NonNullable<StartReport['adoptionLoop']>;
  nextActions: StartReport['nextActions'];
}

export function buildStartReportContext(input: BuildStartReportContextInput): StartReportContext {
  const workflow = chooseWorkflow(input.mode, getWorkflowRecipes().recipes);
  const topRisks = combineRisks(input.workplan, input.quality.topRisks, input.maxRisks);
  const fixFirst = input.workplan.fixFirst ?? fixFirstFromStartRisk(topRisks[0]);
  const adoptionGaps = buildStartAdoptionGaps(input.setup.diagnostics);
  const adoptionLoop = buildAdoptionLoop();
  const firstTenMinutes = buildFirstTenMinutes(input.mode);
  const coordinationHints = buildStartCoordinationHints(
    input.riskSources,
    input.mode,
    input.harnessHints,
    input.intent,
  );
  const missionControl = buildMissionControl({
    mode: input.mode,
    intent: input.intent,
    setupOverall: input.setup.overall,
    workplan: input.workplan,
    workflow,
    fixFirst,
    adoptionGaps,
    coordinationHints,
    riskSources: input.riskSources,
    missionOutcome: input.missionOutcome,
  });
  const nextActions = buildStartNextActions({
    missionControl,
    firstTenMinutes,
    workflow,
    adoptionLoop,
    workplan: input.workplan,
    quality: input.quality,
  });
  return {
    workflow,
    firstTenMinutes,
    missionControl,
    coordinationHints,
    topRisks,
    fixFirst,
    adoptionGaps,
    adoptionLoop,
    nextActions,
  };
}
