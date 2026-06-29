import fs from 'node:fs/promises';
import path from 'node:path';

import { escapeMarkdownText, markdownInlineCode, markdownInlineList } from './markdownSafety.js';
import { computeProofBroker } from './proofBroker.js';
import { prepareProofArtifactWritePath } from './proofLedger.js';
import { quoteShellArg } from './startShellArgs.js';
import { atomicWriteFile } from '../utils/atomicWrite.js';
import type {
  ComputeReviewGateOptions,
  ReviewGateDecision,
  ReviewGateProofDebt,
  ReviewGateProofDebtItem,
  ReviewGateRecontractGuidance,
  ReviewGateReport,
  ReviewGateStatus,
} from '../types/reviewGate.js';
import type {
  ProofBrokerGap,
  ProofBrokerGapKind,
  ProofBrokerReport,
  ProofBrokerRequiredProof,
} from '../types/proofBroker.js';

const DEFAULT_CONTRACT_PATH = '.projscan/proof-contract.json';
const DEFAULT_REVIEW_GATE_PATH = '.projscan/review-gate.json';
const PROOF_DEBT_KINDS: ProofBrokerGapKind[] = [
  'missing-contract',
  'scope-drift',
  'missing-proof',
  'failed-proof',
  'stale-proof',
  'weak-proof',
  'recipe-gap',
];

export async function computeReviewGate(
  rootPath: string,
  options: ComputeReviewGateOptions = {},
): Promise<ReviewGateReport> {
  const root = path.resolve(rootPath);
  const proofBroker = await computeProofBroker(root, {
    intent: options.intent,
    contractPath: options.contractPath,
    saveContractPath: options.saveContractPath,
    outputPassportPath: options.outputPassportPath,
    maxFiles: options.maxFiles,
    feedbackPath: options.feedbackPath,
    baseRef: options.baseRef,
    ledgerPath: options.ledgerPath,
    proofRecipes: options.proofRecipes,
  });

  const output = options.outputPath
    ? await prepareReviewGateOutput(root, options.outputPath)
    : undefined;
  const report = buildReviewGateReport(proofBroker, options, output?.relativePath);

  if (output) {
    await atomicWriteFile(output.fullPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  return report;
}

function buildReviewGateReport(
  proofBroker: ProofBrokerReport,
  options: ComputeReviewGateOptions,
  reviewGatePath?: string,
): ReviewGateReport {
  const proofDebt = proofDebtFrom(proofBroker);
  const status = deriveStatus(proofBroker, proofDebt);
  const contractPath = contractPathFor(proofBroker, options);
  const nextCommands = unique([
    ...proofBroker.nextCommands,
    `projscan review-gate --contract ${quoteShellArg(contractPath)} --pr-comment`,
  ]);
  const reportWithoutComment = {
    schemaVersion: 1 as const,
    kind: 'review-gate' as const,
    generatedAt: new Date().toISOString(),
    status,
    ...(proofBroker.intent ? { intent: proofBroker.intent } : {}),
    decision: decisionFor(status, proofDebt),
    reviewer: proofBroker.reviewer,
    proofDebt,
    recontract: recontractGuidanceFor(proofBroker, proofDebt, contractPath),
    requiredReviewers: proofBroker.requiredReviewers,
    nextCommands,
    warnings: proofBroker.warnings,
    artifacts: {
      ...proofBroker.artifacts,
      ...(reviewGatePath ? { reviewGatePath } : {}),
    },
    proofBroker,
  };
  return {
    ...reportWithoutComment,
    prComment: {
      title: 'Projscan Review Gate',
      markdown: renderReviewGateMarkdown(reportWithoutComment),
    },
  };
}

function proofDebtFrom(proofBroker: ProofBrokerReport): ReviewGateProofDebt {
  const requiredProofById = new Map<string, ProofBrokerRequiredProof>(
    proofBroker.requiredProof.map((row) => [row.id, row]),
  );
  const gaps = [...proofBroker.gaps, ...proofStatusGaps(proofBroker)];
  const items = uniqueDebtItems(
    gaps.map((gap) => debtItemFromGap(gap, requiredProofById)),
  );
  const blockers = items.filter((item) => item.severity === 'blocker').length;
  const warnings = items.filter((item) => item.severity === 'warning').length;
  return {
    total: items.length,
    blockers,
    warnings,
    byKind: countsByKind(items),
    items,
  };
}

function proofStatusGaps(proofBroker: ProofBrokerReport): ProofBrokerGap[] {
  const gapCommands = new Set(proofBroker.gaps.map((gap) => gap.command).filter(Boolean));
  const gaps: ProofBrokerGap[] = [];
  for (const command of proofBroker.proof.missingCommands) {
    if (gapCommands.has(command)) continue;
    gaps.push({
      kind: 'missing-proof',
      severity: 'warning',
      message: `Proof command ${command} has not been recorded.`,
      command,
    });
  }
  for (const command of proofBroker.proof.failedCommands) {
    if (gapCommands.has(command)) continue;
    gaps.push({
      kind: 'failed-proof',
      severity: 'blocker',
      message: `Proof command ${command} failed.`,
      command,
    });
  }
  for (const command of proofBroker.proof.staleCommands) {
    if (gapCommands.has(command)) continue;
    gaps.push({
      kind: 'stale-proof',
      severity: 'warning',
      message: `Proof command ${command} is stale.`,
      command,
    });
  }
  return gaps;
}

function debtItemFromGap(
  gap: ProofBrokerGap,
  requiredProofById: Map<string, ProofBrokerRequiredProof>,
): ReviewGateProofDebtItem {
  const proof = gap.requirementId ? requiredProofById.get(gap.requirementId) : undefined;
  const id = [
    gap.kind,
    gap.requirementId,
    gap.command,
    gap.file,
    gap.message,
  ]
    .filter(Boolean)
    .join(':');
  return {
    id,
    kind: gap.kind,
    severity: gap.severity,
    message: gap.message,
    ...(gap.command ? { command: gap.command } : {}),
    ...(gap.file ? { file: gap.file } : {}),
    ...(gap.requirementId ? { requirementId: gap.requirementId } : {}),
    ...(proof?.requiredReviewers ? { requiredReviewers: proof.requiredReviewers } : {}),
    nextAction: nextActionForGap(gap),
  };
}

function nextActionForGap(gap: ProofBrokerGap): string {
  if (gap.kind === 'missing-contract') {
    return 'Create a Proof Contract, then rerun projscan review-gate.';
  }
  if (gap.kind === 'scope-drift') {
    return 'Stop and create a new Proof Contract before review.';
  }
  if (gap.kind === 'failed-proof') {
    return gap.command
      ? `Fix the failure, rerun ${gap.command}, then rerun projscan review-gate.`
      : 'Fix the failed proof, then rerun projscan review-gate.';
  }
  if (gap.kind === 'stale-proof') {
    return gap.command
      ? `Rerun ${gap.command}, then rerun projscan review-gate.`
      : 'Rerun the stale proof, then rerun projscan review-gate.';
  }
  if (gap.kind === 'weak-proof') {
    return gap.command
      ? `Run stronger proof with ${gap.command}, then rerun projscan review-gate.`
      : 'Run stronger proof, then rerun projscan review-gate.';
  }
  if (gap.kind === 'recipe-gap') {
    return gap.command
      ? `Satisfy the Team Proof Recipe with ${gap.command}, then rerun projscan review-gate.`
      : 'Satisfy the Team Proof Recipe, then rerun projscan review-gate.';
  }
  return gap.command
    ? `Run ${gap.command}, then rerun projscan review-gate.`
    : 'Run the missing proof, then rerun projscan review-gate.';
}

function deriveStatus(proofBroker: ProofBrokerReport, proofDebt: ReviewGateProofDebt): ReviewGateStatus {
  if (proofDebt.items.some((item) => item.kind === 'scope-drift')) return 'drifted';
  if (proofDebt.items.some((item) => item.kind === 'missing-contract')) return 'blocked';
  if (proofDebt.items.some((item) => item.kind === 'failed-proof')) return 'blocked';
  if (proofBroker.status === 'blocked') return 'blocked';
  if (proofBroker.status === 'drifted') return 'drifted';
  if (proofDebt.total > 0) return 'needs-proof';
  return proofBroker.status;
}

function decisionFor(status: ReviewGateStatus, proofDebt: ReviewGateProofDebt): ReviewGateDecision {
  if (status === 'ready') {
    return {
      allowReview: true,
      outcome: status,
      summary: 'Review can proceed with the current evidence.',
    };
  }
  if (status === 'drifted') {
    return {
      allowReview: false,
      outcome: status,
      summary: 'Review is blocked until the agent creates a new Proof Contract for the drifted scope.',
    };
  }
  if (status === 'blocked') {
    return {
      allowReview: false,
      outcome: status,
      summary: `Review is blocked: ${proofDebt.blockers} blocker proof debt item(s) remain.`,
    };
  }
  return {
    allowReview: false,
    outcome: status,
    summary: `Review is not ready: ${proofDebt.total} proof debt item(s) remain.`,
  };
}

function recontractGuidanceFor(
  proofBroker: ProofBrokerReport,
  proofDebt: ReviewGateProofDebt,
  contractPath: string,
): ReviewGateRecontractGuidance {
  const driftFiles = unique([
    ...proofBroker.scope.forbiddenTouched,
    ...proofBroker.scope.outsideAllowed,
    ...proofDebt.items.filter((item) => item.kind === 'scope-drift').map((item) => item.file ?? ''),
  ]);
  const missingContract = proofDebt.items.some((item) => item.kind === 'missing-contract');
  const required =
    missingContract ||
    driftFiles.length > 0 ||
    proofBroker.reviewer.action === 'stop-and-recontract';
  if (!required) {
    return {
      required: false,
      reason: 'Current change is inside the approved boundary.',
      driftFiles: [],
      command: `projscan prove --intent "<change intent>" --save-contract ${quoteShellArg(contractPath)}`,
    };
  }
  return {
    required: true,
    reason:
      driftFiles.length > 0
        ? 'The current change left the approved boundary. Create a new contract instead of silently widening scope.'
        : 'A Proof Contract is required before review.',
    driftFiles,
    command: `projscan prove --intent "<change intent>" --save-contract ${quoteShellArg(contractPath)}`,
  };
}

export function renderReviewGateMarkdown(
  report: Omit<ReviewGateReport, 'prComment'>,
): string {
  const lines: string[] = [
    '## Projscan Review Gate',
    '',
    `- **Status:** ${report.status}`,
    `- **Allow review:** ${report.decision.allowReview ? 'yes' : 'no'}`,
    `- **Reviewer action:** ${report.reviewer.action}`,
    `- **Reviewer decision:** ${report.reviewer.decision}`,
    `- **Summary:** ${escapeMarkdownText(report.decision.summary)}`,
  ];
  if (report.intent) lines.push(`- **Intent:** ${escapeMarkdownText(report.intent)}`);
  lines.push('');
  lines.push('### Proof debt');
  lines.push('');
  lines.push(`- **Total:** ${report.proofDebt.total}`);
  lines.push(`- **Blockers:** ${report.proofDebt.blockers}`);
  lines.push(`- **Warnings:** ${report.proofDebt.warnings}`);
  if (report.proofDebt.items.length === 0) {
    lines.push('- none');
  } else {
    for (const item of report.proofDebt.items) {
      const target = item.command ?? item.file ?? item.requirementId ?? item.kind;
      lines.push(
        `- **${item.severity}:** ${escapeMarkdownText(item.message)} (${markdownInlineCode(target)})`,
      );
      lines.push(`  - next: ${escapeMarkdownText(item.nextAction)}`);
    }
  }
  lines.push('');
  lines.push('### Recontract');
  lines.push('');
  lines.push(`- **Required:** ${report.recontract.required ? 'yes' : 'no'}`);
  lines.push(`- **Reason:** ${escapeMarkdownText(report.recontract.reason)}`);
  lines.push(`- **Drift files:** ${markdownInlineList(report.recontract.driftFiles)}`);
  lines.push(`- **Command:** ${markdownInlineCode(report.recontract.command)}`);
  lines.push('');
  lines.push('### Required Reviewers');
  lines.push('');
  lines.push(`- **Reviewers:** ${markdownInlineList(report.requiredReviewers)}`);
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
  if (report.artifacts.reviewGatePath) {
    lines.push(`- **Review Gate:** ${markdownInlineCode(report.artifacts.reviewGatePath)}`);
  }
  if (!report.artifacts.contractPath && !report.artifacts.passportPath && !report.artifacts.reviewGatePath) {
    lines.push('- none');
  }
  return lines.join('\n');
}

function contractPathFor(proofBroker: ProofBrokerReport, options: ComputeReviewGateOptions): string {
  return (
    proofBroker.artifacts.contractPath ??
    options.contractPath ??
    options.saveContractPath ??
    DEFAULT_CONTRACT_PATH
  );
}

function countsByKind(items: ReviewGateProofDebtItem[]): Record<ProofBrokerGapKind, number> {
  const counts = Object.fromEntries(PROOF_DEBT_KINDS.map((kind) => [kind, 0])) as Record<
    ProofBrokerGapKind,
    number
  >;
  for (const item of items) counts[item.kind] += 1;
  return counts;
}

function uniqueDebtItems(items: ReviewGateProofDebtItem[]): ReviewGateProofDebtItem[] {
  const seen = new Set<string>();
  const result: ReviewGateProofDebtItem[] = [];
  for (const item of items) {
    const key = [item.kind, item.severity, item.message, item.command, item.file, item.requirementId].join(
      '\0',
    );
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function prepareReviewGateOutput(
  rootPath: string,
  outputPath: string,
): Promise<{ fullPath: string; relativePath: string }> {
  const fullPath = resolveReviewGateOutputPath(rootPath, outputPath);
  await prepareProofArtifactWritePath(rootPath, fullPath);
  await assertWritableReviewGateOutput(fullPath);
  return {
    fullPath,
    relativePath: path.relative(rootPath, fullPath).split(path.sep).join('/'),
  };
}

function resolveReviewGateOutputPath(rootPath: string, outputPath: string): string {
  const root = path.resolve(rootPath);
  const requested = outputPath.trim() || DEFAULT_REVIEW_GATE_PATH;
  const fullPath = path.resolve(root, requested);
  const relative = path.relative(root, fullPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Review Gate artifact path must stay inside the project root.');
  }
  const normalized = relative.split(path.sep).join('/');
  if (
    normalized !== DEFAULT_REVIEW_GATE_PATH &&
    !/^\.projscan\/review-gates\/[^/]+\.json$/.test(normalized)
  ) {
    throw new Error(
      'Review Gate artifact path must be .projscan/review-gate.json or .projscan/review-gates/<name>.json.',
    );
  }
  return fullPath;
}

async function assertWritableReviewGateOutput(fullPath: string): Promise<void> {
  let stat;
  try {
    stat = await fs.lstat(fullPath);
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Refusing to overwrite symlinked review gate: ${fullPath}`);
  if (!stat.isFile()) throw new Error(`Existing review gate path is not a file: ${fullPath}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
  } catch {
    throw new Error(`Refusing to overwrite existing output that is not a Review Gate: ${fullPath}`);
  }
  if (!isRecord(parsed) || parsed.kind !== 'review-gate' || parsed.schemaVersion !== 1) {
    throw new Error(`Refusing to overwrite existing output that is not a Review Gate: ${fullPath}`);
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
