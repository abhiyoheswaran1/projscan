import { computeBugHunt } from './bugHunt.js';
import {
  buildDailyPrWorkflow,
  renderEvidencePackPrComment,
  validateEvidencePackPrComment,
} from './evidenceComment.js';
export { buildDailyPrWorkflow, renderEvidencePackPrComment, validateEvidencePackPrComment };
import { computePreflight } from './preflight.js';
import { computeProve } from './prove.js';
import { buildEvidencePackArtifacts } from './releaseEvidenceArtifacts.js';
import { safeBaselineTrend } from './releaseEvidenceBaseline.js';
import { buildEvidencePackPrSummary } from './releaseEvidencePrSummary.js';
export { calibratePreflightTrust } from './releaseEvidencePrSummary.js';
import {
  approvalRecommendation,
  blockingEvidence,
  calibrateEvidencePackVerdict,
  evidencePackVerdict,
  summarizeEvidencePack,
} from './releaseEvidenceVerdict.js';
import { computeReleaseTrain } from './releaseTrain.js';
import { computeWorkplan } from './workplan.js';
import { loadOwnership } from './ownership.js';
import type {
  EvidencePackProofReceiptSummary,
  EvidencePackReport,
  PreflightSuggestedAction,
  ReleaseTrainReport,
} from '../types.js';

export interface ComputeEvidencePackOptions {
  lines?: string[];
  includeWebsitePrompt?: boolean;
  includePrComment?: boolean;
  maxFindings?: number;
  preflightMaxChangedFiles?: number;
}

export async function computeEvidencePack(
  rootPath: string,
  options: ComputeEvidencePackOptions = {},
): Promise<EvidencePackReport> {
  const [train, bugHunt, workplan, preflight] = await Promise.all([
    computeReleaseTrain(rootPath, { lines: options.lines }),
    computeBugHunt(rootPath, { maxFindings: options.maxFindings }),
    computeWorkplan(rootPath, { mode: 'release', maxTasks: 6 }),
    computePreflight(rootPath, {
      mode: 'before_merge',
      maxChangedFiles: options.preflightMaxChangedFiles,
    }),
  ]);
  const artifacts = buildEvidencePackArtifacts(train, bugHunt, workplan, preflight);
  const rawVerdict = evidencePackVerdict(artifacts);
  const blockingReasons = blockingEvidence(preflight, bugHunt, workplan);
  const changelogEntries = buildChangelogEntries();
  const suggestedNextActions = dedupeActions([
    ...train.suggestedNextActions,
    ...workplan.suggestedNextActions,
    ...preflight.suggestedNextActions,
    ...bugHunt.fixQueue.slice(0, 4).map((finding) => ({
      label: finding.title,
      command: finding.verification.commands[0],
    })),
  ]);

  const [baselineTrend, ownership] = await Promise.all([
    safeBaselineTrend(rootPath),
    loadOwnership(rootPath).catch(() => undefined),
  ]);
  const prSummary = buildEvidencePackPrSummary({
    workplan,
    bugHunt,
    preflight,
    nextActions: suggestedNextActions,
    baselineTrend,
    ownership,
  });
  const verdict = calibrateEvidencePackVerdict(rawVerdict, prSummary);
  const proofReceipt = options.includePrComment
    ? await safeProofReceipt(rootPath)
    : undefined;

  const report: EvidencePackReport = {
    schemaVersion: 1,
    currentVersion: train.currentVersion,
    readOnly: true,
    verdict,
    summary: summarizeEvidencePack(verdict, train.currentVersion, blockingReasons),
    train: {
      lines: train.plan.lines,
      readiness: train.readiness,
    },
    approval: {
      required: true,
      recommendation: approvalRecommendation(verdict),
      blockingReasons,
    },
    artifacts,
    changelogEntries,
    ...(options.includeWebsitePrompt
      ? { websitePrompt: buildWebsitePrompt(train, changelogEntries) }
      : {}),
    prSummary,
    ...(proofReceipt ? { proofReceipt } : {}),
    dailyPrWorkflow: buildDailyPrWorkflow(),
    suggestedNextActions,
  };
  if (!options.includePrComment) return report;
  const prComment = renderEvidencePackPrComment(report);
  return {
    ...report,
    prComment,
    prCommentValidation: validateEvidencePackPrComment(prComment, report),
  };
}

async function safeProofReceipt(rootPath: string): Promise<EvidencePackProofReceiptSummary> {
  const command = 'projscan prove --changed --format markdown';
  try {
    const report = await computeProve(rootPath, { changed: true });
    const receipt = report.receipt;
    if (!receipt || receipt.scope.status === 'missing-contract') {
      return {
        available: false,
        command,
        summary: 'No Proof Contract was available for this evidence pack.',
        proofStatus: 'missing',
        reviewerDecision: 'needs-focused-review',
        missingCommands: [],
        failedCommands: [],
        staleCommands: [],
      };
    }
    return {
      available: true,
      command,
      summary: receipt.summary,
      proofStatus: receipt.proofStatus.status,
      reviewerDecision: receipt.reviewerDecision,
      scopeStatus: receipt.scope.status,
      riskDeltaDirection: receipt.riskDeltaDirection,
      missingCommands: receipt.proofStatus.missingCommands,
      failedCommands: receipt.proofStatus.failedCommands,
      staleCommands: receipt.proofStatus.staleCommands,
    };
  } catch (error) {
    return {
      available: false,
      command,
      summary: `Proof Receipt unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      proofStatus: 'missing',
      reviewerDecision: 'needs-focused-review',
      missingCommands: [],
      failedCommands: [],
      staleCommands: [],
    };
  }
}

function buildChangelogEntries(): string[] {
  return [
    '`projscan_evidence_pack` / `projscan evidence-pack` produce one approval-ready packet with planning, preflight, workplan, bug-hunt, changelog, and website-update evidence.',
    '`projscan_regression_plan` / `projscan regression-plan` build a smoke/focused/full verification matrix from bug-hunt, preflight, and product risk.',
    '`projscan_agent_brief` / `projscan agent-brief` create compact next-agent context packets with focus items, guardrails, and repo context.',
    '`projscan_quality_scorecard` / `projscan quality-scorecard` summarize health, security, tests, maintainability, and coordination with top risks and commands.',
  ];
}

function buildWebsitePrompt(train: ReleaseTrainReport, changelogEntries: string[]): string {
  return [
    'Update the projscan website for the next release using the current repository evidence.',
    `Product lines covered: ${train.plan.lines.join(', ')}.`,
    'Highlight the new agent-facing surfaces: projscan_workplan, projscan_bug_hunt, projscan_release_train, projscan_evidence_pack, projscan_regression_plan, projscan_agent_brief, and projscan_quality_scorecard.',
    'Use these product bullets:',
    ...changelogEntries.map((entry) => `- ${entry}`),
    'Keep claims grounded in the completed product evidence.',
  ].join('\n');
}

function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const result: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = `${action.label}:${action.command ?? ''}:${action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result.slice(0, 12);
}
