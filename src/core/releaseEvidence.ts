import fs from 'node:fs/promises';
import path from 'node:path';

import { computeBugHunt } from './bugHunt.js';
import { computePreflight } from './preflight.js';
import { computeReleaseTrain } from './releaseTrain.js';
import { computeWorkplan } from './workplan.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { loadOwnership, type OwnershipLookup } from './ownership.js';
import { scanRepository } from './repositoryScanner.js';
import { computeDiff, loadBaseline } from '../utils/baseline.js';
import { applyConfigToIssues, loadConfig } from '../utils/config.js';
import type {
  BugHuntReport,
  EvidencePackArtifact,
  EvidencePackArtifactStatus,
  BaselineTrend,
  EvidencePackPrCommentValidation,
  EvidencePackPrSummary,
  EvidencePackReport,
  EvidencePackTopRisk,
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

  const [baselineTrend, ownership] = await Promise.all([
    safeBaselineTrend(rootPath),
    loadOwnership(rootPath).catch(() => undefined),
  ]);
  const prSummary = buildPrSummary(workplan, bugHunt, preflight, suggestedNextActions, baselineTrend, ownership);

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
    prSummary,
    suggestedNextActions,
  };
  if (!options.includePrComment) return report;
  const prComment = renderEvidencePackPrComment(report);
  return { ...report, prComment, prCommentValidation: validateEvidencePackPrComment(prComment, report) };
}


export function renderEvidencePackPrComment(report: EvidencePackReport): string {
  const blockers = report.approval.blockingReasons.slice(0, 5);
  const commands = dedupeStrings(report.artifacts.flatMap((artifact) => artifact.commands)).slice(0, 8);
  const nextActions = report.suggestedNextActions.slice(0, 5);
  const pr = report.prSummary;
  const blockingReasonLabel = pr?.trust.verdict === 'manual_review' ? 'manual gate' : 'blocker';
  const lines = [
    '## projscan approval evidence',
    '',
    `**Verdict:** ${report.verdict}`,
    `**Version:** ${report.currentVersion ?? 'unknown'}`,
    `**Summary:** ${report.summary}`,
    '',
    '### Verdict',
    `- ${pr?.verdictLabel ?? report.verdict}: ${pr?.decision ?? report.approval.recommendation}`,
    ...(blockers.length > 0 ? blockers.map((reason) => `- ${blockingReasonLabel}: ${reason}`) : ['- blockers: none recorded']),
    '',
    '### Trust Calibration',
    ...(pr?.trust ? formatTrustCalibration(pr.trust) : ['- Trust signals unavailable; run `projscan preflight --mode before_merge --format json`.']),
    '',
    '### Baseline Trend',
    ...(pr?.baselineTrend ? formatBaselineTrend(pr.baselineTrend) : ['- No local baseline found. Run `projscan diff --save-baseline` after the first clean review.']),
    '',
    '### Top Risks',
    ...(pr?.topRisks.length ? pr.topRisks.map(formatPrRisk) : ['- No prioritized risks recorded.']),
    '',
    '### Team Routing',
    ...(pr?.teamRoutes.length ? pr.teamRoutes.map(formatTeamRoute) : ['- No owner hints found. Add CODEOWNERS or package owner metadata for routing.']),
    '',
    '### Verification',
    ...commands.map((command) => `- \`${command}\``),
    '',
    '### Next Commands',
    ...(pr?.nextCommands.length ? pr.nextCommands.map((command) => `- \`${command}\``) : ['- `projscan preflight --mode before_merge --format json`']),
    '',
    '### Suggested Next Actions',
    ...(nextActions.length > 0 ? nextActions.map(formatSuggestedAction) : ['- None recorded.']),
    '',
    `Approval guidance: ${formatApprovalGuidance(report)}`,
  ];
  return `${lines.join('\n')}\n`;
}



const REQUIRED_PR_COMMENT_SECTIONS = [
  '## projscan approval evidence',
  '### Verdict',
  '### Trust Calibration',
  '### Baseline Trend',
  '### Top Risks',
  '### Team Routing',
  '### Verification',
  '### Next Commands',
  '### Suggested Next Actions',
] as const;

const GITHUB_COMMENT_LIMIT = 65_536;

export function validateEvidencePackPrComment(
  markdown: string,
  report?: EvidencePackReport,
): EvidencePackPrCommentValidation {
  const missingSections = REQUIRED_PR_COMMENT_SECTIONS.filter((section) => !markdown.includes(section));
  const actionableCommand = hasActionableCommand(markdown, report);
  const renderedSanely = !/undefined|\[object Object\]/.test(markdown);
  const checks: EvidencePackPrCommentValidation['checks'] = [
    {
      id: 'required-sections',
      status: missingSections.length > 0 ? 'fail' : 'pass',
      summary: missingSections.length > 0
        ? `Missing required PR section(s): ${missingSections.map((section) => section.replace(/^#+\s*/, '')).join(', ')}`
        : 'All required PR sections are present.',
    },
    {
      id: 'github-size',
      status: markdown.length > GITHUB_COMMENT_LIMIT ? 'fail' : 'pass',
      summary: `${markdown.length} character(s), GitHub comment limit ${GITHUB_COMMENT_LIMIT}.`,
    },
    {
      id: 'render-sanity',
      status: renderedSanely ? 'pass' : 'fail',
      summary: renderedSanely
        ? 'Rendered comment has no unresolved placeholder strings.'
        : 'Rendered comment contains an unresolved placeholder or object string.',
    },
    {
      id: 'actionable-commands',
      status: actionableCommand ? 'pass' : 'fail',
      summary: actionableCommand
        ? 'Comment includes at least one exact next command.'
        : 'Comment does not include an exact next command.',
    },
  ];
  const status = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : checks.some((check) => check.status === 'warn')
      ? 'warn'
      : 'pass';
  return { status, checks };
}

function hasActionableCommand(markdown: string, report: EvidencePackReport | undefined): boolean {
  if (/`(?:projscan|npm|npx|gh|git)\b/.test(markdown)) return true;
  return (report?.prSummary?.nextCommands.length ?? 0) > 0;
}

async function safeBaselineTrend(rootPath: string): Promise<BaselineTrend | undefined> {
  const baselinePath = path.join(rootPath, '.projscan-baseline.json');
  try {
    await fs.access(baselinePath);
  } catch {
    return undefined;
  }
  try {
    const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
    const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
    const issues = applyConfigToIssues(await collectIssues(rootPath, scan.files), configResult.config);
    const hotspots = await analyzeHotspots(rootPath, scan.files, issues, { limit: 20 });
    const baseline = await loadBaseline(baselinePath, rootPath);
    return computeDiff(baseline, issues, hotspots).trend;
  } catch {
    return undefined;
  }
}

function buildPrSummary(
  workplan: WorkplanReport,
  bugHunt: BugHuntReport,
  preflight: PreflightReport,
  nextActions: PreflightSuggestedAction[],
  baselineTrend: BaselineTrend | undefined,
  ownership: OwnershipLookup | undefined,
): EvidencePackPrSummary {
  const topRisks = buildPrTopRisks(workplan, bugHunt, ownership);
  const teamRoutes = buildTeamRoutes(topRisks);
  const trust = calibratePreflightTrust(preflight);
  const nextCommands = buildPrNextCommands(nextActions);
  const concreteBlockers = concreteDefectMessages(preflight);
  const verdictLabel = concreteBlockers.length > 0
    ? 'Concrete blocker'
    : preflight.evidence.releaseScale?.detected
      ? 'Manual review'
      : preflight.verdict === 'proceed'
        ? 'Ready'
        : 'Needs review';
  const decision = concreteBlockers.length > 0
    ? `${concreteBlockers.length} concrete blocker(s) need fixing before approval.`
    : preflight.evidence.releaseScale?.detected
      ? 'Scale or complexity needs human sign-off; no concrete taint/dataflow/health/plugin/supply-chain blocker was found.'
      : preflight.verdict === 'proceed'
        ? 'No blocking or cautionary preflight signals found.'
        : 'Review cautions and run the listed next actions before approval.';
  return {
    verdictLabel,
    decision,
    trust,
    topRisks,
    teamRoutes,
    nextCommands,
    ...(baselineTrend ? { baselineTrend } : {}),
  };
}


export function calibratePreflightTrust(preflight: PreflightReport): EvidencePackPrSummary['trust'] {
  const concreteBlockers = concreteDefectMessages(preflight);
  const warningReasons = preflight.reasons.filter((reason) => reason.severity === 'warning');
  const manualReviewReasons = preflight.reasons.filter(
    (reason) => reason.severity === 'warning' || isReleaseScaleReviewReason(preflight, reason),
  );
  const manualReviewSignals = dedupeStrings([
    ...(preflight.evidence.releaseScale?.detected ? [preflight.evidence.releaseScale.explanation] : []),
    ...manualReviewReasons
      .filter((reason) => ['changed-files', 'git', 'hotspots', 'release', 'review'].includes(reason.source))
      .map((reason) => reason.message),
  ]).slice(0, 5);
  const watchSignals = dedupeStrings(
    warningReasons
      .filter((reason) => !['changed-files', 'git', 'hotspots', 'release', 'review'].includes(reason.source))
      .map((reason) => reason.message),
  ).slice(0, 5);
  const verdict: EvidencePackPrSummary['trust']['verdict'] = concreteBlockers.length > 0
    ? 'actual_defect'
    : manualReviewSignals.length > 0 || watchSignals.length > 0
      ? 'manual_review'
      : 'clean';
  const summary = verdict === 'actual_defect'
    ? `${concreteBlockers.length} actual defect/blocker signal(s) require fixes.`
    : verdict === 'manual_review'
      ? `${manualReviewSignals.length + watchSignals.length} manual review/watch signal(s); no actual defect blocker was found.`
      : 'clean: no actual defect, manual review, or watch signals found.';
  return { verdict, summary, concreteBlockers, manualReviewSignals, watchSignals };
}

function concreteDefectMessages(preflight: PreflightReport): string[] {
  return dedupeStrings([
    ...preflight.reasons
      .filter((reason) => isConcreteDefectReason(preflight, reason))
      .map((reason) => reason.message),
    ...(preflight.evidence.releaseScale?.concreteBlockers ?? []),
  ]).slice(0, 5);
}

function isConcreteDefectReason(preflight: PreflightReport, reason: PreflightReport['reasons'][number]): boolean {
  if (reason.severity !== 'error') return false;
  return !isReleaseScaleReviewReason(preflight, reason);
}

function isReleaseScaleReviewReason(preflight: PreflightReport, reason: PreflightReport['reasons'][number]): boolean {
  const releaseScale = preflight.evidence.releaseScale;
  return releaseScale?.detected === true
    && releaseScale.concreteBlockers.length === 0
    && reason.source === 'review'
    && /scale\/complexity|release-scale|large platform|changed-file risk/i.test(reason.message);
}

function buildPrNextCommands(actions: PreflightSuggestedAction[]): string[] {
  return dedupeStrings([
    'projscan preflight --mode before_merge --format json',
    ...actions.map((action) => action.command ?? (action.tool ? `MCP ${action.tool}` : '')).filter(Boolean),
  ]).slice(0, 6);
}

function buildPrTopRisks(
  workplan: WorkplanReport,
  bugHunt: BugHuntReport,
  ownership: OwnershipLookup | undefined,
): EvidencePackTopRisk[] {
  const risks: EvidencePackTopRisk[] = [];
  for (const risk of workplan.topRisks) {
    const files = risk.file ? [risk.file] : [];
    risks.push({
      priority: risk.priority,
      title: risk.message,
      files,
      ...(ownerFor(files, ownership) ? { owner: ownerFor(files, ownership) } : {}),
      command: risk.tool ? toolCommand(risk.tool) : 'projscan preflight --format json',
    });
  }
  for (const finding of bugHunt.topSuspects) {
    risks.push({
      priority: finding.priority,
      title: finding.title,
      files: finding.files,
      ...(ownerFor(finding.files, ownership) ? { owner: ownerFor(finding.files, ownership) } : {}),
      command: finding.verification.commands[0] ?? 'projscan bug-hunt --format json',
    });
  }
  const seen = new Set<string>();
  return risks.filter((risk) => {
    const key = `${risk.title}:${risk.files.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function buildTeamRoutes(risks: EvidencePackTopRisk[]) {
  const byOwner = new Map<string, Set<string>>();
  for (const risk of risks) {
    if (!risk.owner) continue;
    const files = byOwner.get(risk.owner) ?? new Set<string>();
    for (const file of risk.files) files.add(file);
    byOwner.set(risk.owner, files);
  }
  return [...byOwner.entries()].map(([owner, files]) => ({
    owner,
    files: [...files].slice(0, 5),
    reason: 'owns one or more top PR risks',
  }));
}

function ownerFor(files: string[], ownership: OwnershipLookup | undefined): string | undefined {
  if (!ownership) return undefined;
  for (const file of files) {
    const owner = ownership(file);
    if (owner) return owner;
  }
  return undefined;
}

function toolCommand(tool: string): string {
  if (tool === 'projscan_review') return 'projscan review --format json';
  if (tool === 'projscan_hotspots') return 'projscan hotspots --format json';
  if (tool === 'projscan_doctor') return 'projscan doctor --format json';
  return 'projscan preflight --format json';
}


function formatApprovalGuidance(report: EvidencePackReport): string {
  if (report.verdict === 'blocked' && report.prSummary?.trust.verdict === 'manual_review') {
    return 'Require human release sign-off; no actual-defect blocker is recorded unless reviewers confirm one.';
  }
  return report.approval.recommendation;
}

function formatTrustCalibration(trust: EvidencePackPrSummary['trust']): string[] {
  return [
    `- ${trust.summary}`,
    ...(trust.concreteBlockers.length > 0
      ? [`- actual defects: ${trust.concreteBlockers.join('; ')}`]
      : ['- actual defects: none']),
    ...(trust.manualReviewSignals.length > 0
      ? [`- manual review: ${trust.manualReviewSignals.join('; ')}`]
      : ['- manual review: none']),
    ...(trust.watchSignals.length > 0
      ? [`- watch signals: ${trust.watchSignals.join('; ')}`]
      : ['- watch signals: none']),
  ];
}

function formatBaselineTrend(trend: BaselineTrend): string[] {
  return [
    `- ${trend.summary}`,
    ...(trend.newHotspots.length > 0 ? [`- new hotspots: ${trend.newHotspots.join(', ')}`] : []),
    ...(trend.recurringNoisyRules.length > 0
      ? [`- recurring noisy rules: ${trend.recurringNoisyRules.map((rule) => `${rule.id} (${rule.before}->${rule.after})`).join(', ')}`]
      : []),
  ];
}

function formatPrRisk(risk: EvidencePackTopRisk): string {
  const files = risk.files.length > 0 ? ` files: ${risk.files.join(', ')}` : '';
  const owner = risk.owner ? ` owner: ${risk.owner}` : ' owner: unassigned';
  return `- **${risk.priority}** ${risk.title}${owner}${files} run: \`${risk.command}\``;
}

function formatTeamRoute(route: { owner: string; files: string[]; reason: string }): string {
  return `- ${route.owner}: ${route.reason}${route.files.length > 0 ? ` (${route.files.join(', ')})` : ''}`;
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
