import { computeBugHunt } from './bugHunt.js';
import { renderEvidencePackPrComment, validateEvidencePackPrComment } from './evidenceComment.js';
export { renderEvidencePackPrComment, validateEvidencePackPrComment } from './evidenceComment.js';
import { computePreflight } from './preflight.js';
import { safeBaselineTrend } from './releaseEvidenceBaseline.js';
import {
  buildEvidencePackPrSummary,
  concreteDefectMessages,
} from './releaseEvidencePrSummary.js';
export { calibratePreflightTrust } from './releaseEvidencePrSummary.js';
import { computeReleaseTrain } from './releaseTrain.js';
import { computeWorkplan } from './workplan.js';
import { loadOwnership } from './ownership.js';
import type {
  BugHuntReport,
  EvidencePackArtifact,
  EvidencePackArtifactStatus,
  EvidencePackPrSummary,
  EvidencePackReport,
  EvidencePackVerdict,
  PreflightReport,
  PreflightSuggestedAction,
  PreflightVerdict,
  ReleaseTrainReport,
  WorkplanReport,
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
  const artifacts = buildArtifacts(train, bugHunt, workplan, preflight);
  const rawVerdict = packVerdict(artifacts);
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

  const report: EvidencePackReport = {
    schemaVersion: 1,
    currentVersion: train.currentVersion,
    readOnly: true,
    verdict,
    summary: summarize(verdict, train.currentVersion, blockingReasons),
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

function buildArtifacts(
  train: ReleaseTrainReport,
  bugHunt: BugHuntReport,
  workplan: WorkplanReport,
  preflight: PreflightReport,
): EvidencePackArtifact[] {
  return [
    {
      id: 'ep-release-train',
      title: 'Product plan readiness',
      status: statusFromPreflight(train.readiness.verdict),
      summary: train.readiness.summary,
      evidence: [
        `${train.plan.lines.length} product line(s): ${train.plan.lines.join(', ')}`,
        `${train.readiness.blockers} blocker(s), ${train.readiness.cautions} caution(s)`,
        'read-only evidence: yes',
      ],
      commands: ['projscan release-train --format json'],
    },
    {
      id: 'ep-bug-hunt',
      title: 'Bug-hunt queue',
      status:
        bugHunt.verdict === 'block' ? 'blocked' : bugHunt.verdict === 'fix' ? 'caution' : 'ready',
      summary: bugHunt.summary,
      evidence: [
        `health score ${bugHunt.health.score}`,
        bugHuntQueueEvidence(bugHunt),
        `preflight evidence during bug hunt: ${bugHunt.evidence.preflightVerdict}`,
      ],
      commands: ['projscan bug-hunt --format json'],
    },
    {
      id: 'ep-workplan',
      title: 'Agent workplan',
      status: statusFromPreflight(workplan.verdict),
      summary: workplan.summary,
      evidence: [
        `${workplan.tasks.length} task(s)`,
        `${workplan.topRisks.length} top risk(s)`,
        workplan.coordination.recommendedNextAgent,
      ],
      commands: [
        'projscan workplan --mode release --format json',
        'projscan handoff --mode release',
      ],
    },
    {
      id: 'ep-preflight',
      title: 'Preflight gate',
      status: statusFromPreflight(preflight.verdict),
      summary: preflight.summary,
      evidence: preflight.requiredChecks.map((check) => `${check.name}: ${check.status}`),
      commands: ['projscan preflight --mode before_merge --format json'],
    },
  ];
}

function bugHuntQueueEvidence(bugHunt: BugHuntReport): string {
  const queueLabel = bugHunt.summary.includes('manual sign-off action')
    ? 'manual sign-off action(s)'
    : 'fix target(s)';
  return `${bugHunt.fixQueue.length} ${queueLabel} in queue`;
}

function blockingEvidence(
  preflight: PreflightReport,
  bugHunt: BugHuntReport,
  workplan: WorkplanReport,
): string[] {
  return dedupeStrings([
    ...(concreteDefectMessages(preflight).length > 0
      ? concreteDefectMessages(preflight)
      : preflight.verdict === 'block' && preflight.evidence.releaseScale?.detected
        ? [preflight.evidence.releaseScale.explanation]
        : []),
    ...(bugHunt.verdict === 'block'
      ? bugHunt.fixQueue
          .filter((finding) => finding.priority === 'p0')
          .map((finding) => finding.title)
      : []),
    ...(workplan.verdict === 'block'
      ? workplan.topRisks.filter((risk) => risk.priority === 'p0').map((risk) => risk.message)
      : []),
  ]).slice(0, 10);
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

function packVerdict(artifacts: EvidencePackArtifact[]): EvidencePackVerdict {
  if (artifacts.some((artifact) => artifact.status === 'blocked')) return 'blocked';
  if (artifacts.some((artifact) => artifact.status === 'caution')) return 'caution';
  return 'ready';
}

function calibrateEvidencePackVerdict(
  verdict: EvidencePackVerdict,
  prSummary: EvidencePackPrSummary,
): EvidencePackVerdict {
  if (
    verdict === 'blocked' &&
    prSummary.trust.verdict === 'manual_review' &&
    prSummary.trust.concreteBlockers.length === 0
  ) {
    return 'caution';
  }
  return verdict;
}

function summarize(
  verdict: EvidencePackVerdict,
  currentVersion: string | null | undefined,
  blockingReasons: string[],
): string {
  const version = currentVersion ?? 'current version';
  if (verdict === 'blocked') {
    return `blocked: ${blockingReasons[0] ?? 'product evidence still contains blocking signals'}`;
  }
  if (verdict === 'caution') {
    return `caution: ${version} evidence is assembled but still needs explicit review`;
  }
  return `ready: ${version} evidence is assembled for approval`;
}

function approvalRecommendation(verdict: EvidencePackVerdict): string {
  if (verdict === 'blocked')
    return 'Do not approve launch until p0 evidence is cleared or accepted.';
  if (verdict === 'caution')
    return 'Review cautions, then approve only after the regression plan passes.';
  return 'Approval can proceed after the recorded regression commands pass.';
}

function statusFromPreflight(verdict: PreflightVerdict): EvidencePackArtifactStatus {
  if (verdict === 'block') return 'blocked';
  if (verdict === 'caution') return 'caution';
  return 'ready';
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

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
