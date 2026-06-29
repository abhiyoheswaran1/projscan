import { markdownInlineCode, markdownInlineList, escapeMarkdownText } from './markdownSafety.js';
import { computePassport } from './passport.js';
import { quoteShellArg } from './startShellArgs.js';
import type {
  AgentChangePassport,
  AgentChangePassportArtifacts,
} from '../types/passport.js';
import type {
  ProofBrokerGap,
  ProofBrokerPrPassport,
  ProofBrokerPrPassportSection,
  ProofBrokerReport,
  ProofBrokerRequiredProof,
  ComputeProofBrokerOptions,
} from '../types/proofBroker.js';
import type { ProveReceipt } from '../types/prove.js';

const DEFAULT_CONTRACT_PATH = '.projscan/proof-contract.json';
const PR_PASSPORT_SECTIONS: ProofBrokerPrPassportSection[] = [
  'reviewer',
  'scope',
  'required-proof',
  'gaps',
  'reviewers',
  'next-commands',
  'artifacts',
];

export async function computeProofBroker(
  rootPath: string,
  options: ComputeProofBrokerOptions = {},
): Promise<ProofBrokerReport> {
  const passport = await computePassport(rootPath, {
    intent: options.intent,
    contractPath: options.contractPath,
    saveContractPath: options.saveContractPath,
    outputPath: options.outputPassportPath,
    maxFiles: options.maxFiles,
    feedbackPath: options.feedbackPath,
    baseRef: options.baseRef,
    ledgerPath: options.ledgerPath,
    proofRecipes: options.proofRecipes,
  });
  return buildProofBrokerReport(passport, options);
}

function buildProofBrokerReport(
  passport: AgentChangePassport,
  options: ComputeProofBrokerOptions,
): ProofBrokerReport {
  const receipt = passport.prove.receipt;
  const requiredProof = requiredProofRows(receipt);
  const requiredReviewers = unique([
    ...passport.receipt.requiredReviewers,
    ...requiredProof.flatMap((row) => row.requiredReviewers ?? []),
  ]);
  const scope = {
    status: passport.receipt.scopeStatus,
    changedFiles: passport.receipt.changedFiles,
    riskyChangedFiles: riskyChangedFiles(passport, requiredProof),
    forbiddenTouched: passport.receipt.forbiddenTouched,
    outsideAllowed: passport.receipt.outsideAllowed,
    changedAfterProof: passport.receipt.changedAfterProof,
  };
  const gaps = brokerGaps(passport, receipt, requiredProof);
  const nextCommands = nextCommandsFor(passport, requiredProof, options);
  const reportWithoutPassport = {
    schemaVersion: 1 as const,
    kind: 'proof-broker' as const,
    generatedAt: new Date().toISOString(),
    status: passport.status,
    summary: brokerSummary(passport, gaps),
    ...(passport.intent ? { intent: passport.intent } : {}),
    reviewer: passport.reviewer,
    requiredProof,
    proof: {
      status: passport.receipt.proofStatus,
      ...(passport.receipt.proofSufficiencyStatus
        ? { sufficiencyStatus: passport.receipt.proofSufficiencyStatus }
        : {}),
      ...(passport.receipt.proofReplayStatus ? { replayStatus: passport.receipt.proofReplayStatus } : {}),
      missingCommands: passport.receipt.missingCommands,
      failedCommands: passport.receipt.failedCommands,
      staleCommands: passport.receipt.staleCommands,
    },
    scope,
    requiredReviewers,
    gaps,
    nextCommands,
    warnings: passport.warnings,
    artifacts: passport.artifacts,
    passport,
  };
  const report = {
    ...reportWithoutPassport,
    prPassport: buildPrPassport(reportWithoutPassport),
  };
  return report;
}

function brokerSummary(passport: AgentChangePassport, gaps: ProofBrokerGap[]): string {
  const blockerCount = gaps.filter((gap) => gap.severity === 'blocker').length;
  if (blockerCount > 0) {
    return `${passport.status}: ${blockerCount} blocking proof or scope gap(s) need reviewer action.`;
  }
  if (gaps.length > 0) {
    return `${passport.status}: ${gaps.length} proof gap(s) remain before review.`;
  }
  return `${passport.status}: required proof is ready for reviewer handoff.`;
}

function requiredProofRows(receipt: ProveReceipt | undefined): ProofBrokerRequiredProof[] {
  return (receipt?.proofSufficiency?.requirements ?? []).map((requirement) => ({
    id: requirement.id,
    surface: requirement.surface,
    status: requirement.status,
    files: requirement.files,
    requiredCommands: requirement.requiredCommands,
    matchedCommands: requirement.matchedCommands,
    requiredReview: requirement.requiredReview,
    reason: requirement.reason,
    gaps: requirement.gaps,
    ...(requirement.source ? { source: requirement.source } : {}),
    ...(requirement.recipeId ? { recipeId: requirement.recipeId } : {}),
    ...(requirement.requiredReviewers ? { requiredReviewers: requirement.requiredReviewers } : {}),
  }));
}

function riskyChangedFiles(
  passport: AgentChangePassport,
  requiredProof: ProofBrokerRequiredProof[],
): string[] {
  const changed = new Set(passport.receipt.changedFiles);
  const requirementFiles = requiredProof.flatMap((requirement) =>
    requirement.files.filter((file) => changed.has(file)),
  );
  const scope = passport.prove.receipt?.scope;
  return unique([
    ...passport.receipt.forbiddenTouched,
    ...passport.receipt.outsideAllowed,
    ...passport.receipt.changedAfterProof,
    ...(scope?.securitySensitiveTouched ?? []),
    ...(scope?.configTouched ?? []),
    ...(scope?.unexpectedProduction ?? []),
    ...requirementFiles,
  ]);
}

function brokerGaps(
  passport: AgentChangePassport,
  receipt: ProveReceipt | undefined,
  requiredProof: ProofBrokerRequiredProof[],
): ProofBrokerGap[] {
  const gaps: ProofBrokerGap[] = [];
  if (!receipt || passport.receipt.scopeStatus === 'missing-contract') {
    gaps.push({
      kind: 'missing-contract',
      severity: 'blocker',
      message: 'Create a Proof Contract before review.',
      command: 'projscan prove --intent "<change intent>" --save-contract .projscan/proof-contract.json',
    });
  }
  for (const file of passport.receipt.forbiddenTouched) {
    gaps.push({
      kind: 'scope-drift',
      severity: 'blocker',
      message: `${file} is forbidden by the Proof Contract.`,
      file,
    });
  }
  for (const file of passport.receipt.outsideAllowed) {
    gaps.push({
      kind: 'scope-drift',
      severity: 'blocker',
      message: `${file} is outside the approved boundary.`,
      file,
    });
  }
  for (const file of passport.receipt.changedAfterProof) {
    gaps.push({
      kind: 'stale-proof',
      severity: 'warning',
      message: `${file} changed after proof ran.`,
      file,
      command: changedReceiptCommand(passport.artifacts),
    });
  }
  for (const requirement of requiredProof) {
    gaps.push(...proofRequirementGaps(requirement, passport.receipt));
  }
  for (const gap of receipt?.recipeGaps ?? []) {
    gaps.push({
      kind: 'recipe-gap',
      severity: 'warning',
      message: gap,
      command: commandFromRecipeGap(gap),
    });
  }
  return uniqueGaps(gaps);
}

function proofRequirementGaps(
  requirement: ProofBrokerRequiredProof,
  receipt: AgentChangePassport['receipt'],
): ProofBrokerGap[] {
  const gaps: ProofBrokerGap[] = [];
  const missingCommands = requirement.requiredCommands.filter(
    (command) =>
      receipt.missingCommands.includes(command) || !requirement.matchedCommands.includes(command),
  );
  for (const command of missingCommands) {
    gaps.push({
      kind: 'missing-proof',
      severity: 'warning',
      message: `${requirement.id} needs proof command ${command}.`,
      command,
      requirementId: requirement.id,
    });
  }
  for (const command of requirement.requiredCommands.filter((cmd) => receipt.failedCommands.includes(cmd))) {
    gaps.push({
      kind: 'failed-proof',
      severity: 'blocker',
      message: `${requirement.id} has failed proof command ${command}.`,
      command,
      requirementId: requirement.id,
    });
  }
  for (const command of requirement.requiredCommands.filter((cmd) => receipt.staleCommands.includes(cmd))) {
    gaps.push({
      kind: 'stale-proof',
      severity: 'warning',
      message: `${requirement.id} has stale proof command ${command}.`,
      command,
      requirementId: requirement.id,
    });
  }
  if (gaps.length === 0 && ['weak', 'missing', 'stale', 'failed'].includes(requirement.status)) {
    gaps.push({
      kind: requirement.status === 'weak' ? 'weak-proof' : `${requirement.status}-proof`,
      severity: requirement.status === 'failed' ? 'blocker' : 'warning',
      message: requirement.gaps[0] ?? `${requirement.id} needs stronger proof.`,
      requirementId: requirement.id,
    } as ProofBrokerGap);
  }
  return gaps;
}

function nextCommandsFor(
  passport: AgentChangePassport,
  requiredProof: ProofBrokerRequiredProof[],
  options: ComputeProofBrokerOptions,
): string[] {
  const contractPath = contractPathFor(passport.artifacts, options);
  return unique([
    ...passport.receipt.missingCommands,
    ...passport.receipt.failedCommands,
    ...passport.receipt.staleCommands,
    ...requiredProof.flatMap((requirement) => requirement.requiredCommands),
    ...passport.nextCommands,
    `projscan proof-broker --contract ${quoteShellArg(contractPath)} --pr-comment`,
  ]);
}

function changedReceiptCommand(artifacts: AgentChangePassportArtifacts): string {
  return `projscan prove --changed --contract ${quoteShellArg(artifacts.contractPath ?? DEFAULT_CONTRACT_PATH)} --format markdown`;
}

function contractPathFor(
  artifacts: AgentChangePassportArtifacts,
  options: ComputeProofBrokerOptions,
): string {
  return artifacts.contractPath ?? options.contractPath ?? options.saveContractPath ?? DEFAULT_CONTRACT_PATH;
}

function commandFromRecipeGap(gap: string): string | undefined {
  const marker = 'proof command: ';
  const index = gap.indexOf(marker);
  return index >= 0 ? gap.slice(index + marker.length) : undefined;
}

function buildPrPassport(
  report: Omit<ProofBrokerReport, 'prPassport'>,
): ProofBrokerPrPassport {
  return {
    title: 'Projscan PR Passport',
    sections: PR_PASSPORT_SECTIONS,
    markdown: renderPrPassportMarkdown(report),
  };
}

export function renderPrPassportMarkdown(report: Omit<ProofBrokerReport, 'prPassport'>): string {
  const lines: string[] = [
    '## Projscan PR Passport',
    '',
    `- **Status:** ${report.status}`,
    `- **Reviewer action:** ${report.reviewer.action}`,
    `- **Reviewer decision:** ${report.reviewer.decision}`,
    `- **Summary:** ${escapeMarkdownText(report.summary)}`,
  ];
  if (report.intent) lines.push(`- **Intent:** ${escapeMarkdownText(report.intent)}`);
  lines.push('');
  lines.push('### Scope');
  lines.push('');
  lines.push(`- **Boundary status:** ${report.scope.status}`);
  renderList(lines, 'Changed files', report.scope.changedFiles);
  renderList(lines, 'Risky changed files', report.scope.riskyChangedFiles);
  renderList(lines, 'Forbidden touched', report.scope.forbiddenTouched);
  renderList(lines, 'Outside approved boundary', report.scope.outsideAllowed);
  renderList(lines, 'Changed after proof', report.scope.changedAfterProof);
  lines.push('');
  lines.push('### Required Proof');
  lines.push('');
  if (report.requiredProof.length === 0) {
    lines.push('- No proof rows were available.');
  } else {
    for (const row of report.requiredProof) {
      lines.push(
        `- ${markdownInlineCode(row.id)}: ${row.status} on ${row.surface}; commands ${markdownInlineList(row.requiredCommands)}; review ${escapeMarkdownText(row.requiredReview)}`,
      );
    }
  }
  lines.push('');
  lines.push('### Gaps');
  lines.push('');
  if (report.gaps.length === 0) {
    lines.push('- none');
  } else {
    for (const gap of report.gaps) {
      const suffix = gap.command ? ` Run ${markdownInlineCode(gap.command)}.` : '';
      lines.push(`- **${gap.severity}:** ${escapeMarkdownText(gap.message)}${suffix}`);
    }
  }
  lines.push('');
  lines.push('### Required Reviewers');
  lines.push('');
  renderList(lines, 'Reviewers', report.requiredReviewers);
  lines.push('');
  lines.push('### Next Commands');
  lines.push('');
  for (const command of report.nextCommands) lines.push(`- ${markdownInlineCode(command)}`);
  lines.push('');
  lines.push('### Artifacts');
  lines.push('');
  if (report.artifacts.contractPath) {
    lines.push(`- **Proof Contract:** ${markdownInlineCode(report.artifacts.contractPath)}`);
  }
  if (report.artifacts.passportPath) {
    lines.push(`- **Agent Change Passport:** ${markdownInlineCode(report.artifacts.passportPath)}`);
  }
  if (!report.artifacts.contractPath && !report.artifacts.passportPath) lines.push('- none');
  return lines.join('\n');
}

function renderList(lines: string[], label: string, values: string[]): void {
  lines.push(`- **${label}:** ${markdownInlineList(values)}`);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueGaps(gaps: ProofBrokerGap[]): ProofBrokerGap[] {
  const seen = new Set<string>();
  const result: ProofBrokerGap[] = [];
  for (const gap of gaps) {
    const key = [gap.kind, gap.severity, gap.message, gap.command, gap.file, gap.requirementId].join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(gap);
  }
  return result;
}
