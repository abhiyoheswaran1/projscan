import { pluginsEnabled } from './plugins.js';
import { buildEvidence } from './preflightEvidence.js';
import type { PreflightInputs } from './preflightInputs.js';
import { buildPreflightReasons, countSupplyChainIssues } from './preflightReasons.js';
import { buildReleaseScaleEvidence } from './preflightReleaseScale.js';
import { buildRequiredChecks } from './preflightRequiredChecks.js';
import { buildSuggestedActions, buildToolCalls } from './preflightSuggestedActions.js';
import { isPreflightReportTruncated } from './preflightTruncation.js';
import { decidePreflightVerdict, summarizePreflight } from './preflightVerdict.js';
import type { PreflightMode, PreflightReport } from '../types.js';

interface BuildPreflightReportInput {
  mode: PreflightMode;
  inputs: PreflightInputs;
  maxChangedFiles: number;
}

export function buildPreflightReport({
  mode,
  inputs,
  maxChangedFiles,
}: BuildPreflightReportInput): PreflightReport {
  const { issues, health, changedFiles, session, hotspots, review, coordination } = inputs;
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
