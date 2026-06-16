import { computeFirstRunDiagnostics, getWorkflowRecipes } from './adoption.js';
import { fixFirstFromStartRisk } from './fixFirst.js';
import { buildFirstTenMinutes } from './onboarding.js';
import { computeQualityScorecard } from './qualityScorecard.js';
import { buildWorkplanHandoff, computeWorkplan } from './workplan.js';
import { loadMissionOutcome } from './missionOutcome.js';
import { detectStartHarnessHints } from './startHarness.js';
import { buildAdoptionLoop } from './startAdoptionLoop.js';
import { buildStartCoordinationHints, buildStartRiskSources } from './startEvidence.js';
import { buildStartNextActions } from './startNextActions.js';
import { normalizeStartOptions, type ComputeStartOptions } from './startOptions.js';
import { chooseWorkflow, combineRisks, summarize } from './startMissionPolicy.js';
import { buildMissionControl } from './startMissionControl.js';
import { buildStartAdoptionGaps } from './startAdoptionGaps.js';
import type { StartReport } from '../types/start.js';

export type { ComputeStartOptions } from './startOptions.js';

export async function computeStartReport(
  rootPath: string,
  options: ComputeStartOptions = {},
): Promise<StartReport> {
  const { intent, modeResolution, mode, maxTasks, maxRisks } = normalizeStartOptions(options);
  const [setup, workplan, quality, riskSources, missionOutcome, harnessHints] = await Promise.all([
    computeFirstRunDiagnostics(rootPath),
    computeWorkplan(rootPath, { mode, maxTasks }),
    computeQualityScorecard(rootPath, { maxRisks }),
    buildStartRiskSources(rootPath),
    options.missionDir
      ? loadMissionOutcome(rootPath, options.missionDir)
      : Promise.resolve(undefined),
    detectStartHarnessHints(rootPath),
  ]);
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
  const report: StartReport = {
    schemaVersion: 1,
    readOnly: true,
    rootPath,
    mode,
    modeSource: modeResolution.source,
    modeReason: modeResolution.reason,
    summary: summarize(
      mode,
      workplan,
      quality.topRisks.length,
      adoptionGaps.length,
      fixFirst?.title,
    ),
    setup: {
      overall: setup.overall,
      diagnostics: setup.diagnostics,
    },
    recommendedWorkflow: workflow,
    firstTenMinutes,
    missionControl,
    coordinationHints,
    evidence: {
      workplanVerdict: workplan.verdict,
      workplanSummary: workplan.summary,
      qualityVerdict: quality.verdict,
      qualitySummary: quality.summary,
      healthScore: quality.health.score,
      mcpReady:
        setup.diagnostics.find((diagnostic) => diagnostic.id === 'mcp-startup')?.status === 'pass',
      riskSources,
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
