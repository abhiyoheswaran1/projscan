import type { FirstRunReport } from './adoption.js';
import { summarize } from './startMissionPolicy.js';
import { buildWorkplanHandoff } from './workplan.js';
import type { QualityScorecardReport } from '../types/qualityScorecard.js';
import type { StartReport } from '../types/start.js';
import type { WorkplanReport } from '../types/workplan.js';

export interface BuildStartReportInput {
  rootPath: string;
  mode: StartReport['mode'];
  modeSource: StartReport['modeSource'];
  modeReason: string;
  setup: FirstRunReport;
  workplan: WorkplanReport;
  quality: QualityScorecardReport;
  riskSources: StartReport['evidence']['riskSources'];
  workflow: StartReport['recommendedWorkflow'];
  firstTenMinutes: StartReport['firstTenMinutes'];
  missionControl: StartReport['missionControl'];
  coordinationHints: StartReport['coordinationHints'];
  topRisks: StartReport['topRisks'];
  fixFirst: StartReport['fixFirst'];
  adoptionGaps: StartReport['adoptionGaps'];
  adoptionLoop: StartReport['adoptionLoop'];
  nextActions: StartReport['nextActions'];
  includeHandoff?: boolean;
}

export function buildStartReport(input: BuildStartReportInput): StartReport {
  return {
    schemaVersion: 1,
    readOnly: true,
    rootPath: input.rootPath,
    mode: input.mode,
    modeSource: input.modeSource,
    modeReason: input.modeReason,
    summary: summarize(
      input.mode,
      input.workplan,
      input.quality.topRisks.length,
      input.adoptionGaps.length,
      input.fixFirst?.title,
    ),
    setup: {
      overall: input.setup.overall,
      diagnostics: input.setup.diagnostics,
    },
    recommendedWorkflow: input.workflow,
    firstTenMinutes: input.firstTenMinutes,
    missionControl: input.missionControl,
    coordinationHints: input.coordinationHints,
    evidence: {
      workplanVerdict: input.workplan.verdict,
      workplanSummary: input.workplan.summary,
      qualityVerdict: input.quality.verdict,
      qualitySummary: input.quality.summary,
      healthScore: input.quality.health.score,
      mcpReady: mcpReady(input.setup),
      riskSources: input.riskSources,
    },
    topRisks: input.topRisks,
    ...(input.fixFirst ? { fixFirst: input.fixFirst } : {}),
    adoptionGaps: input.adoptionGaps,
    adoptionLoop: input.adoptionLoop,
    nextActions: input.nextActions,
    ...(input.includeHandoff ? { handoff: buildWorkplanHandoff(input.workplan) } : {}),
    ...(isTruncated(input.workplan, input.quality) ? { truncated: true } : {}),
  };
}

function mcpReady(setup: FirstRunReport): boolean {
  return setup.diagnostics.find((diagnostic) => diagnostic.id === 'mcp-startup')?.status === 'pass';
}

function isTruncated(workplan: WorkplanReport, quality: QualityScorecardReport): boolean {
  return workplan.truncated === true || quality.truncated === true;
}
