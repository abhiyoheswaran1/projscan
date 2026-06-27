import fs from 'node:fs/promises';
import path from 'node:path';

import { createBaseframeAssessment } from './baseframeAssessment.js';
import { computeProve } from './prove.js';
import { prepareProofArtifactWritePath } from './proofLedger.js';
import { quoteShellArg } from './startShellArgs.js';
import { atomicWriteFile } from '../utils/atomicWrite.js';
import type {
  AgentChangePassport,
  AgentChangePassportArtifacts,
  AgentChangePassportBaseframe,
  AgentChangePassportBoundary,
  AgentChangePassportReceiptSummary,
  AgentChangePassportReviewerAction,
  AgentChangePassportReviewerSummary,
  AgentChangePassportStatus,
  ComputePassportOptions,
} from '../types/passport.js';
import type { ProveReceipt, ProveReport } from '../types/prove.js';

const DEFAULT_CONTRACT_PATH = '.projscan/proof-contract.json';
const DEFAULT_PASSPORT_PATH = '.projscan/passport.json';

export async function computePassport(
  rootPath: string,
  options: ComputePassportOptions = {},
): Promise<AgentChangePassport> {
  const root = path.resolve(rootPath);
  const intent = normalizeOptionalText(options.intent);
  const contractReport = intent
    ? await computeProve(root, {
        intent,
        saveContractPath: options.saveContractPath,
        maxFiles: options.maxFiles,
        feedbackPath: options.feedbackPath,
        baseRef: options.baseRef,
        proofRecipes: options.proofRecipes,
      })
    : undefined;

  const contractPath = options.contractPath ?? contractReport?.savedContractPath;
  const changedReport = await computeProve(root, {
    changed: true,
    contract: contractReport?.contract,
    contractPath,
    baseRef: options.baseRef,
    ledgerPath: options.ledgerPath,
  });

  const baseframe = await maybeCreateBaseframe(root, {
    intent,
    taskId: options.taskId,
    emitBaseframe: options.emitBaseframe,
  });
  const artifacts: AgentChangePassportArtifacts = {
    ...(contractPath ? { contractPath } : {}),
    ...(contractReport?.savedContractPath ? { contractPath: contractReport.savedContractPath } : {}),
  };
  const passport = buildPassport({
    contractReport,
    changedReport,
    intent: intent ?? changedReport.contract?.intent,
    contractPath: artifacts.contractPath ?? options.contractPath,
    baseframe,
  });

  if (options.outputPath) {
    const passportPath = await writePassportArtifact(root, options.outputPath, passport);
    return {
      ...passport,
      artifacts: {
        ...passport.artifacts,
        passportPath,
      },
    };
  }

  return passport;
}

function buildPassport(input: {
  contractReport?: ProveReport;
  changedReport: ProveReport;
  intent?: string;
  contractPath?: string;
  baseframe?: AgentChangePassportBaseframe;
}): AgentChangePassport {
  const contract = input.changedReport.contract ?? input.contractReport?.contract;
  const receipt = input.changedReport.receipt;
  const receiptSummary = summarizeReceipt(receipt);
  const reviewer = reviewerSummary(input.changedReport, receipt);
  const status = passportStatus(input.changedReport, receipt, reviewer.action);
  const boundary = summarizeBoundary(contract);
  const nextCommands = nextCommandsFor({
    contractPath: input.contractPath,
    boundary,
    receipt: receiptSummary,
    reviewerAction: reviewer.action,
  });
  const artifacts: AgentChangePassportArtifacts = {
    ...(input.contractPath ? { contractPath: input.contractPath } : {}),
  };
  const passport: AgentChangePassport = {
    schemaVersion: 1,
    kind: 'agent-change-passport',
    generatedAt: new Date().toISOString(),
    status,
    ...(input.intent ? { intent: input.intent } : {}),
    summary: summarizePassport(status, reviewer),
    boundary,
    receipt: receiptSummary,
    reviewer,
    nextCommands,
    warnings: unique([...(input.contractReport?.warnings ?? []), ...input.changedReport.warnings]),
    artifacts,
    ...(input.baseframe ? { baseframe: input.baseframe } : {}),
    prove: {
      verdict: input.changedReport.verdict,
      verifiedWorkflow: input.changedReport.verifiedWorkflow,
      ...(contract ? { contract } : {}),
      ...(receipt ? { receipt } : {}),
    },
  };
  return passport;
}

function summarizeBoundary(contract: ProveReport['contract']): AgentChangePassportBoundary {
  return {
    ...(contract?.id ? { contractId: contract.id } : {}),
    allowedFiles: contract?.allowedFiles ?? [],
    forbiddenFiles: contract?.forbiddenFiles ?? [],
    likelyTests: contract?.likelyTests ?? [],
    riskyContracts: contract?.riskyContracts ?? [],
    proofCommands: contract?.proofCommands ?? [],
    ...(contract?.receiptCommand ? { receiptCommand: contract.receiptCommand } : {}),
  };
}

function summarizeReceipt(receipt: ProveReceipt | undefined): AgentChangePassportReceiptSummary {
  return {
    scopeStatus: receipt?.scope.status ?? 'missing-contract',
    proofStatus: receipt?.proofStatus.status ?? 'missing',
    ...(receipt?.proofSufficiency?.status ? { proofSufficiencyStatus: receipt.proofSufficiency.status } : {}),
    ...(receipt?.proofReplay?.status ? { proofReplayStatus: receipt.proofReplay.status } : {}),
    changedFiles: receipt?.scope.changedFiles ?? [],
    forbiddenTouched: receipt?.scope.forbiddenTouched ?? [],
    outsideAllowed: receipt?.scope.outsideAllowed ?? [],
    changedAfterProof: receipt?.proofReplay?.changedAfterProof ?? [],
    missingCommands: receipt?.proofStatus.missingCommands ?? [],
    failedCommands: receipt?.proofStatus.failedCommands ?? [],
    staleCommands: receipt?.proofStatus.staleCommands ?? [],
    requiredReviewers: receipt?.requiredReviewers ?? [],
  };
}

function reviewerSummary(
  report: ProveReport,
  receipt: ProveReceipt | undefined,
): AgentChangePassportReviewerSummary {
  const action = reviewerAction(report, receipt);
  const decision = receipt?.reviewerDecision ?? 'needs-focused-review';
  return {
    decision,
    action,
    summary: reviewerSummaryText(action, receipt),
  };
}

function reviewerAction(
  report: ProveReport,
  receipt: ProveReceipt | undefined,
): AgentChangePassportReviewerAction {
  if (!receipt || receipt.scope.status === 'missing-contract') return 'stop-and-recontract';
  if (receipt.scope.status === 'drifted' || report.verdict === 'blocked') return 'stop-and-recontract';
  if (receipt.proofStatus.status === 'failed') return 'rerun-proof';
  if (receipt.proofStatus.status === 'stale' || receipt.proofReplay?.changedAfterProof.length) {
    return 'rerun-proof';
  }
  if (
    receipt.proofStatus.status === 'missing' ||
    receipt.proofStatus.status === 'not-run' ||
    receipt.proofStatus.status === 'partial' ||
    receipt.proofSufficiency?.status === 'missing' ||
    receipt.proofSufficiency?.status === 'weak'
  ) {
    return 'run-proof';
  }
  return 'review';
}

function reviewerSummaryText(
  action: AgentChangePassportReviewerAction,
  receipt: ProveReceipt | undefined,
): string {
  if (action === 'stop-and-recontract') {
    const drift = receipt?.scope.forbiddenTouched.concat(receipt.scope.outsideAllowed) ?? [];
    return drift.length > 0
      ? `Stop and create a new contract before reviewing: ${drift.join(', ')} drifted.`
      : 'Stop and create a Proof Contract before reviewing.';
  }
  if (action === 'rerun-proof') return 'Rerun proof before review because proof is failed or stale.';
  if (action === 'run-proof') return 'Run the missing proof commands before review.';
  return 'Review can proceed with the current passport evidence.';
}

function passportStatus(
  report: ProveReport,
  receipt: ProveReceipt | undefined,
  action: AgentChangePassportReviewerAction,
): AgentChangePassportStatus {
  if (!receipt || report.verdict === 'blocked') return 'blocked';
  if (action === 'stop-and-recontract') return 'drifted';
  if (action === 'run-proof' || action === 'rerun-proof') return 'needs-proof';
  return 'ready';
}

function summarizePassport(
  status: AgentChangePassportStatus,
  reviewer: AgentChangePassportReviewerSummary,
): string {
  if (status === 'ready') return 'ready: scope and proof are review-ready.';
  if (status === 'needs-proof') return `needs-proof: ${reviewer.summary}`;
  if (status === 'drifted') return `drifted: ${reviewer.summary}`;
  return `blocked: ${reviewer.summary}`;
}

function nextCommandsFor(input: {
  contractPath?: string;
  boundary: AgentChangePassportBoundary;
  receipt: AgentChangePassportReceiptSummary;
  reviewerAction: AgentChangePassportReviewerAction;
}): string[] {
  const commands: string[] = [];
  const contractPath = input.contractPath ?? DEFAULT_CONTRACT_PATH;
  if (input.reviewerAction === 'stop-and-recontract') {
    commands.push('projscan prove --intent "<change intent>" --save-contract .projscan/proof-contract.json');
  }
  if (input.reviewerAction === 'run-proof' || input.reviewerAction === 'rerun-proof') {
    commands.push(...input.receipt.missingCommands);
    commands.push(...input.receipt.failedCommands);
    commands.push(...input.receipt.staleCommands);
    if (commands.length === 0) commands.push(...input.boundary.proofCommands);
  }
  commands.push(`projscan prove --changed --contract ${quoteShellArg(contractPath)} --format markdown`);
  commands.push(`projscan passport --contract ${quoteShellArg(contractPath)} --format markdown`);
  return unique(commands);
}

async function maybeCreateBaseframe(
  root: string,
  input: { intent?: string; taskId?: string; emitBaseframe?: boolean },
): Promise<AgentChangePassportBaseframe | undefined> {
  if (!input.emitBaseframe && !input.taskId) return undefined;
  if (!input.intent) throw new Error('passport Baseframe export requires --intent.');
  if (!input.taskId) throw new Error('passport Baseframe export requires --task-id.');
  await createBaseframeAssessment({
    root,
    intent: input.intent,
    taskId: input.taskId,
  });
  return {
    taskId: input.taskId,
    assessmentPath: `.baseframe/evidence/${input.taskId}/projscan-assessment.json`,
    workflowPath: '.baseframe/agent-workflow.json',
  };
}

async function writePassportArtifact(
  root: string,
  outputPath: string,
  passport: AgentChangePassport,
): Promise<string> {
  const fullPath = resolvePassportOutputPath(root, outputPath);
  await prepareProofArtifactWritePath(root, fullPath);
  await assertWritablePassportOutput(fullPath);
  await atomicWriteFile(fullPath, `${JSON.stringify(passport, null, 2)}\n`);
  return path.relative(root, fullPath).split(path.sep).join('/');
}

function resolvePassportOutputPath(rootPath: string, outputPath: string): string {
  const root = path.resolve(rootPath);
  const requested = outputPath.trim() || DEFAULT_PASSPORT_PATH;
  const fullPath = path.resolve(root, requested);
  const relative = path.relative(root, fullPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Passport artifact path must stay inside the project root.');
  }
  const normalized = relative.split(path.sep).join('/');
  if (normalized !== DEFAULT_PASSPORT_PATH && !/^\.projscan\/passports\/[^/]+\.json$/.test(normalized)) {
    throw new Error(
      'Passport artifact path must be .projscan/passport.json or .projscan/passports/<name>.json.',
    );
  }
  return fullPath;
}

async function assertWritablePassportOutput(fullPath: string): Promise<void> {
  let stat;
  try {
    stat = await fs.lstat(fullPath);
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Refusing to overwrite symlinked passport: ${fullPath}`);
  if (!stat.isFile()) throw new Error(`Existing passport path is not a file: ${fullPath}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
  } catch {
    throw new Error(`Refusing to overwrite existing output that is not an Agent Change Passport: ${fullPath}`);
  }
  if (!isRecord(parsed) || parsed.kind !== 'agent-change-passport' || parsed.schemaVersion !== 1) {
    throw new Error(`Refusing to overwrite existing output that is not an Agent Change Passport: ${fullPath}`);
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
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
