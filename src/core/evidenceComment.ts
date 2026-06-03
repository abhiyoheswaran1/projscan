import type {
  BaselineTrend,
  EvidencePackPrCommentValidation,
  EvidencePackPrSummary,
  EvidencePackReport,
  EvidencePackTopRisk,
  FixFirstRecommendation,
  PreflightSuggestedAction,
} from '../types.js';

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
    '### Reviewer Decision',
    ...formatReviewerDecision(report),
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
    '### First Fix',
    ...(pr?.fixFirst ? formatFixFirst(pr.fixFirst) : ['- No immediate fix-first target. Preserve the baseline and rerun the verification commands.']),
    '',
    '### Team Routing',
    ...(pr?.teamRoutes.length ? pr.teamRoutes.map(formatTeamRoute) : formatMissingOwnerHint(pr)),
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
    '### Developer Feedback',
    ...formatDeveloperFeedback(),
    '',
    `Approval guidance: ${formatApprovalGuidance(report)}`,
  ];
  return `${lines.join('\n')}\n`;
}



const REQUIRED_PR_COMMENT_SECTIONS = [
  '## projscan approval evidence',
  '### Verdict',
  '### Reviewer Decision',
  '### Trust Calibration',
  '### Baseline Trend',
  '### Top Risks',
  '### First Fix',
  '### Team Routing',
  '### Verification',
  '### Next Commands',
  '### Suggested Next Actions',
  '### Developer Feedback',
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

function formatApprovalGuidance(report: EvidencePackReport): string {
  if (report.verdict === 'blocked' && report.prSummary?.trust.verdict === 'manual_review') {
    return 'Require human release sign-off; no actual-defect blocker is recorded unless reviewers confirm one.';
  }
  return report.approval.recommendation;
}

function formatReviewerDecision(report: EvidencePackReport): string[] {
  const trust = report.prSummary?.trust;
  const decision = reviewerDecision(report);
  const firstCommand = report.prSummary?.fixFirst?.commands[0]
    ?? report.prSummary?.nextCommands[0]
    ?? report.suggestedNextActions.find((action) => action.command)?.command
    ?? 'projscan preflight --mode before_merge --format json';
  const routedOwners = report.prSummary?.teamRoutes.map((route) => route.owner) ?? [];
  const ownerState = routedOwners.length > 0 ? routedOwners.join(', ') : 'unassigned';
  const reason = trust?.verdict === 'actual_defect'
    ? 'Concrete blockers are present; fix the first item before approval.'
    : trust?.verdict === 'manual_review'
      ? 'Manual review or release sign-off is required; no concrete blocker is recorded unless listed above.'
      : 'No concrete defect or manual-review signal is recorded; preserve the baseline and run verification.';
  return [
    `- decision: ${decision}`,
    `- reason: ${reason}`,
    `- owner state: ${ownerState}`,
    `- first command: \`${firstCommand}\``,
  ];
}

function reviewerDecision(report: EvidencePackReport): 'ship' | 'review' | 'fix first' {
  const trust = report.prSummary?.trust.verdict;
  if (trust === 'actual_defect' || report.verdict === 'blocked') return trust === 'manual_review' ? 'review' : 'fix first';
  if (trust === 'manual_review' || report.verdict === 'caution') return trust === 'clean' ? 'ship' : 'review';
  return 'ship';
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
  const riskDirection = trend.riskDirection ?? inferRiskDirection(trend.scoreDelta);
  const riskDelta = trend.riskDelta ?? -trend.scoreDelta;
  const changedSinceBaseline = trend.changedSinceBaseline ?? [];
  const qualityBefore = trend.qualityScoreBefore;
  const qualityAfter = trend.qualityScoreAfter;
  const quality = typeof qualityBefore === 'number' && typeof qualityAfter === 'number'
    ? ` (quality ${qualityBefore}->${qualityAfter})`
    : '';
  return [
    `- ${trend.summary}`,
    `- risk from baseline: ${riskDirection}${riskDelta === 0 ? '' : ` ${riskDelta > 0 ? '+' : ''}${riskDelta}`}${quality}`,
    ...(changedSinceBaseline.length > 0 ? [`- changed since baseline: ${changedSinceBaseline.join('; ')}`] : []),
    ...(trend.newHotspots.length > 0 ? [`- new hotspots: ${trend.newHotspots.join(', ')}`] : []),
    ...(trend.recurringNoisyRules.length > 0
      ? [`- recurring noisy rules: ${trend.recurringNoisyRules.map((rule) => `${rule.id} (${rule.before}->${rule.after})`).join(', ')}`]
      : []),
  ];
}

function inferRiskDirection(scoreDelta: number): 'up' | 'down' | 'flat' {
  if (scoreDelta < 0) return 'up';
  if (scoreDelta > 0) return 'down';
  return 'flat';
}

function formatPrRisk(risk: EvidencePackTopRisk): string {
  const files = risk.files.length > 0 ? ` files: ${risk.files.join(', ')}` : '';
  const owner = risk.owner ? ` owner: ${risk.owner}` : ' owner: unassigned';
  return `- **${risk.priority}** ${risk.title}${owner}${files} run: \`${risk.command}\``;
}

function formatTeamRoute(route: { owner: string; files: string[]; reason: string }): string {
  return `- ${route.owner}: ${route.reason}${route.files.length > 0 ? ` (${route.files.join(', ')})` : ''}`;
}

function formatMissingOwnerHint(pr: EvidencePackPrSummary | undefined): string[] {
  if (pr?.ownershipSuggestion) {
    return [
      `- No owner hints found. Add .github/CODEOWNERS line: \`${pr.ownershipSuggestion}\``,
      '- Replace `@team-name` with the owning team before merging.',
    ];
  }
  return ['- No owner hints found. Add .github/CODEOWNERS or package owner metadata for routing.'];
}


function formatFixFirst(fix: FixFirstRecommendation): string[] {
  return [
    `- **${fix.priority}** ${fix.title}${fix.owner ? ` owner: ${fix.owner}` : ''}`,
    `- why first: ${fix.whyFirst}`,
    ...(fix.files.length > 0 ? [`- files: ${fix.files.join(', ')}`] : []),
    ...fix.commands.slice(0, 4).map((command) => `- run: \`${command}\``),
    ...(fix.expected ? [`- fixed when: ${fix.expected}`] : []),
  ];
}

function formatDeveloperFeedback(): string[] {
  return [
    '- Was this useful on this PR? Ask the reviewer whether the comment saved 10-20 minutes.',
    '- Minutes saved: `0|5|10|20+`.',
    '- Prevented bad edit or missed review step: `yes|no`.',
    '- Owner routing clear: `yes|no`. Next command clear: `yes|no`.',
    '- False positives or noisy rules: `none|<rule ids>`.',
    '- What was missing or noisy? Capture one missing signal, one noisy rule, or `none` before merge.',
    '- Keep using it every PR: `projscan evidence-pack --pr-comment`, `projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10`, then `projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json`.',
  ];
}

function formatSuggestedAction(action: PreflightSuggestedAction): string {
  const references = [
    action.command ? `\`${action.command}\`` : undefined,
    action.tool ? `MCP \`${action.tool}\`` : undefined,
  ].filter(Boolean);
  return references.length > 0 ? `- ${action.label}: ${references.join(' / ')}` : `- ${action.label}`;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
