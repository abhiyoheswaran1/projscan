import { computeFirstRunDiagnostics } from './adoption.js';
import { computeQualityScorecard } from './qualityScorecard.js';
import { computeWorkplan } from './workplan.js';
import { loadMissionOutcome } from './missionOutcome.js';
import { detectStartHarnessHints } from './startHarness.js';
import { buildStartRiskSources } from './startEvidence.js';
import { buildStartRoadmapPreview } from './startRoadmapPreview.js';
import type { ComputeStartOptions } from './startOptions.js';
import type { WorkplanMode } from '../types.js';

export interface StartInputConfig {
  mode: WorkplanMode;
  maxTasks: number;
  maxRisks: number;
}

export async function loadStartInputs(
  rootPath: string,
  options: ComputeStartOptions,
  config: StartInputConfig,
) {
  const [
    setup,
    workplan,
    quality,
    riskSources,
    missionOutcome,
    harnessHints,
    roadmapPreview,
  ] = await Promise.all([
    computeFirstRunDiagnostics(rootPath),
    computeWorkplan(rootPath, { mode: config.mode, maxTasks: config.maxTasks }),
    computeQualityScorecard(rootPath, { maxRisks: config.maxRisks }),
    buildStartRiskSources(rootPath),
    options.missionDir
      ? loadMissionOutcome(rootPath, options.missionDir)
      : Promise.resolve(undefined),
    detectStartHarnessHints(rootPath),
    config.mode === 'release' ? buildStartRoadmapPreview(rootPath) : Promise.resolve(undefined),
  ]);

  return {
    setup,
    workplan,
    quality,
    riskSources,
    missionOutcome,
    harnessHints,
    roadmapPreview,
  };
}
