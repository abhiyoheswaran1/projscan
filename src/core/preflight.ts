import { pluginsEnabled } from './plugins.js';
import { buildRequiredChecks } from './preflightRequiredChecks.js';
import { buildReleaseScaleEvidence } from './preflightReleaseScale.js';
import { buildEvidence } from './preflightEvidence.js';
import {
  buildSuggestedActions,
  buildToolCalls,
} from './preflightSuggestedActions.js';
import {
  decidePreflightVerdict,
  summarizePreflight,
} from './preflightVerdict.js';
import {
  buildPreflightReasons,
  countSupplyChainIssues,
} from './preflightReasons.js';
import { loadPreflightInputs } from './preflightInputs.js';
import { isPreflightReportTruncated } from './preflightTruncation.js';
import type {
  PreflightMode,
  PreflightReport,
} from '../types.js';

export { decidePreflightVerdict, summarizePreflight };

export interface ComputePreflightOptions {
  mode?: PreflightMode;
  baseRef?: string;
  headRef?: string;
  maxChangedFiles?: number;
  enablePlugins?: boolean;
}

const DEFAULT_MAX_CHANGED_FILES = 50;

export async function computePreflight(
  rootPath: string,
  options: ComputePreflightOptions = {},
): Promise<PreflightReport> {
  const mode = options.mode ?? 'before_edit';
  const { issues, health, changedFiles, session, hotspots, review, coordination } =
    await loadPreflightInputs(rootPath, mode, options);
  const maxChangedFiles = options.maxChangedFiles ?? DEFAULT_MAX_CHANGED_FILES;
  const supplyChain = countSupplyChainIssues(issues);
  const releaseScale = buildReleaseScaleEvidence({
    mode,
    issues,
    changedFiles,
    health,
    review,
    supplyChain,
    maxChangedFiles,
  });
  const reasons = buildPreflightReasons({
    mode,
    issues,
    changedFiles,
    health,
    session,
    hotspots,
    review,
    releaseScale,
    coordination,
    maxChangedFiles,
  });
  const verdict = decidePreflightVerdict(reasons);
  const evidence = buildEvidence({
    health,
    changedFiles,
    session,
    hotspots,
    issues,
    pluginsEnabledForRun: pluginsEnabled(),
    review,
    releaseScale,
    coordination,
  });
  const truncated = isPreflightReportTruncated({ evidence, changedFiles });
  const report: PreflightReport = {
    schemaVersion: 1,
    mode,
    verdict,
    summary: '',
    reasons,
    evidence,
    requiredChecks: buildRequiredChecks({
      mode,
      health,
      changedFiles,
      review,
      supplyChain,
      releaseScale,
    }),
    suggestedNextActions: buildSuggestedActions({ reasons, mode, changedFiles }),
    toolCalls: buildToolCalls({ reasons, mode, changedFiles }),
    ...(truncated ? { truncated: true } : {}),
  };
  return { ...report, summary: summarizePreflight(report) };
}
