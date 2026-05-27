import { computeBugHunt } from './bugHunt.js';
import { computePreflight } from './preflight.js';
import { computeReleaseTrain } from './releaseTrain.js';
import { computeWorkplan } from './workplan.js';
import type {
  BugHuntReport,
  EvidencePackArtifact,
  EvidencePackArtifactStatus,
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
}

export async function computeEvidencePack(
  rootPath: string,
  options: ComputeEvidencePackOptions = {},
): Promise<EvidencePackReport> {
  const [train, bugHunt, workplan, preflight] = await Promise.all([
    computeReleaseTrain(rootPath, { lines: options.lines }),
    computeBugHunt(rootPath, { maxFindings: options.maxFindings }),
    computeWorkplan(rootPath, { mode: 'release', maxTasks: 6 }),
    computePreflight(rootPath, { mode: 'before_merge' }),
  ]);
  const artifacts = buildArtifacts(train, bugHunt, workplan, preflight);
  const verdict = packVerdict(artifacts);
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

  const report: EvidencePackReport = {
    schemaVersion: 1,
    currentVersion: train.currentVersion,
    readOnly: true,
    verdict,
    summary: summarize(verdict, train, blockingReasons),
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
    ...(options.includeWebsitePrompt ? { websitePrompt: buildWebsitePrompt(train, changelogEntries) } : {}),
    suggestedNextActions,
  };
  return options.includePrComment ? { ...report, prComment: renderEvidencePackPrComment(report) } : report;
}


export function renderEvidencePackPrComment(report: EvidencePackReport): string {
  const blockers = report.approval.blockingReasons.slice(0, 5);
  const commands = dedupeStrings(report.artifacts.flatMap((artifact) => artifact.commands)).slice(0, 8);
  const nextActions = report.suggestedNextActions.slice(0, 5);
  const lines = [
    '## projscan approval evidence',
    '',
    `**Verdict:** ${report.verdict}`,
    `**Version:** ${report.currentVersion ?? 'unknown'}`,
    `**Summary:** ${report.summary}`,
    '',
    '### Artifacts',
    ...report.artifacts.map((artifact) => `- **${artifact.title}:** ${artifact.status} - ${artifact.summary}`),
    '',
    '### Blocking Reasons',
    ...(blockers.length > 0 ? blockers.map((reason) => `- ${reason}`) : ['- None recorded.']),
    '',
    '### Verification',
    ...commands.map((command) => `- \`${command}\``),
    '',
    '### Suggested Next Actions',
    ...(nextActions.length > 0 ? nextActions.map(formatSuggestedAction) : ['- None recorded.']),
    '',
    `Approval guidance: ${report.approval.recommendation}`,
  ];
  return `${lines.join('\n')}\n`;
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
      status: bugHunt.verdict === 'block' ? 'blocked' : bugHunt.verdict === 'fix' ? 'caution' : 'ready',
      summary: bugHunt.summary,
      evidence: [
        `health score ${bugHunt.health.score}`,
        `${bugHunt.fixQueue.length} fix target(s) in queue`,
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
      commands: ['projscan workplan --mode release --format json', 'projscan handoff --mode release'],
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

function blockingEvidence(
  preflight: PreflightReport,
  bugHunt: BugHuntReport,
  workplan: WorkplanReport,
): string[] {
  return dedupeStrings([
    ...preflight.reasons
      .filter((reason) => reason.severity === 'error')
      .map((reason) => reason.message),
    ...(bugHunt.verdict === 'block'
      ? bugHunt.fixQueue
          .filter((finding) => finding.priority === 'p0')
          .map((finding) => finding.title)
      : []),
    ...(workplan.verdict === 'block'
      ? workplan.topRisks
          .filter((risk) => risk.priority === 'p0')
          .map((risk) => risk.message)
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

function formatSuggestedAction(action: PreflightSuggestedAction): string {
  const references = [
    action.command ? `\`${action.command}\`` : undefined,
    action.tool ? `MCP \`${action.tool}\`` : undefined,
  ].filter(Boolean);
  return references.length > 0 ? `- ${action.label}: ${references.join(' / ')}` : `- ${action.label}`;
}

function packVerdict(artifacts: EvidencePackArtifact[]): EvidencePackVerdict {
  if (artifacts.some((artifact) => artifact.status === 'blocked')) return 'blocked';
  if (artifacts.some((artifact) => artifact.status === 'caution')) return 'caution';
  return 'ready';
}

function summarize(
  verdict: EvidencePackVerdict,
  train: ReleaseTrainReport,
  blockingReasons: string[],
): string {
  if (verdict === 'blocked') {
    return `blocked: ${blockingReasons[0] ?? 'product evidence still contains blocking signals'}`;
  }
  if (verdict === 'caution') {
    return `caution: ${train.plan.lines.join(', ')} evidence is assembled but still needs explicit review`;
  }
  return `ready: ${train.plan.lines.join(', ')} evidence is assembled for approval`;
}

function approvalRecommendation(verdict: EvidencePackVerdict): string {
  if (verdict === 'blocked') return 'Do not approve launch until p0 evidence is cleared or accepted.';
  if (verdict === 'caution') return 'Review cautions, then approve only after the regression plan passes.';
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
