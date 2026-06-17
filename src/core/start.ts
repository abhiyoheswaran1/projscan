import { getWorkflowRecipes } from './adoption.js';
import { fixFirstFromStartRisk } from './fixFirst.js';
import { buildFirstTenMinutes } from './onboarding.js';
import { buildAdoptionLoop } from './startAdoptionLoop.js';
import { buildStartCoordinationHints } from './startEvidence.js';
import { loadStartInputs } from './startInputs.js';
import { buildStartNextActions } from './startNextActions.js';
import { normalizeStartOptions, type ComputeStartOptions } from './startOptions.js';
import { chooseWorkflow, combineRisks } from './startMissionPolicy.js';
import { buildMissionControl } from './startMissionControl.js';
import { buildStartAdoptionGaps } from './startAdoptionGaps.js';
import { buildStartReport } from './startReportBuilder.js';
import type { StartReport } from '../types/start.js';

export type { ComputeStartOptions } from './startOptions.js';

export async function computeStartReport(
  rootPath: string,
  options: ComputeStartOptions = {},
): Promise<StartReport> {
  const { intent, modeResolution, mode, maxTasks, maxRisks } = normalizeStartOptions(options);
  const { setup, workplan, quality, riskSources, missionOutcome, harnessHints } =
    await loadStartInputs(rootPath, options, { mode, maxTasks, maxRisks });
  const workflow = chooseWorkflow(mode, getWorkflowRecipes().recipes);
  const topRisks = combineRisks(workplan, quality.topRisks, maxRisks);
  const fixFirst = workplan.fixFirst ?? fixFirstFromStartRisk(topRisks[0]);
  const adoptionGaps = buildStartAdoptionGaps(setup.diagnostics);
  const adoptionLoop = buildAdoptionLoop();
  const firstTenMinutes = buildFirstTenMinutes(mode);
  const coordinationHints = buildStartCoordinationHints(riskSources, mode, harnessHints);
  const missionControl = buildMissionControl({
    mode,
    intent,
    setupOverall: setup.overall,
    workplan,
    workflow,
    fixFirst,
    adoptionGaps,
    coordinationHints,
    riskSources,
    missionOutcome,
  });
  const nextActions = buildStartNextActions({
    missionControl,
    firstTenMinutes,
    workflow,
    adoptionLoop,
    workplan,
    quality,
  });
  return buildStartReport({
    rootPath,
    mode,
    modeSource: modeResolution.source,
    modeReason: modeResolution.reason,
    setup,
    workplan,
    quality,
    riskSources,
    workflow,
    firstTenMinutes,
    missionControl,
    coordinationHints,
    topRisks,
    fixFirst,
    adoptionGaps,
    adoptionLoop,
    nextActions,
    includeHandoff: options.includeHandoff,
  });
}
