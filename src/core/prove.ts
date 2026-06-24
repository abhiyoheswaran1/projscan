import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { readFeedbackFile } from './feedback.js';
import {
  appendProofLedgerRecord,
  changedFileFingerprint,
  latestProofRecordFor,
  readProofLedger,
  redactProofOutput,
} from './proofLedger.js';
import { quoteShellArg } from './startShellArgs.js';
import { computeSimulation } from './simulate.js';
import { getChangedFiles } from '../utils/changedFiles.js';
import type { AssessConfidence, RiskDeltaSnapshot } from '../types/assess.js';
import type {
  ProveChangedFileClassification,
  ProveContract,
  ProveProofCommandEvidence,
  ProveReceipt,
  ProveReport,
  ProveReviewerDecision,
  ProveRiskDeltaDirection,
  ProveScopeStatus,
  ProveVerdict,
  ProveVerifiedWorkflow,
} from '../types/prove.js';

export interface ComputeProveOptions {
  intent?: string;
  changed?: boolean;
  contract?: ProveContract;
  contractPath?: string;
  saveContractPath?: string;
  maxFiles?: number;
  feedbackPath?: string;
  baseRef?: string;
  ledgerPath?: string;
  recordCommand?: string;
  exitCode?: number;
  durationMs?: number;
  summary?: string;
  logPath?: string;
  runCommand?: string[];
  runTimeoutMs?: number;
}

const DEFAULT_CONTRACT_PATH = '.projscan/proof-contract.json';
const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000;
const PROOF_RUN_TIMEOUT_EXIT_CODE = 124;
const COMMAND_NOT_FOUND_EXIT_CODE = 127;
const MAX_PROOF_RUN_OUTPUT_CHARS = 256 * 1024;
const MAX_PROOF_RUN_LOG_CHARS = 512 * 1024;
const GENERATED_FORBIDDEN_PATTERNS = [
  '.agentflight/**',
  '.agentloop/**',
  '.git/**',
  '.projscan-memory/**',
  'coverage/**',
  'dist/**',
  'node_modules/**',
];
const HIGH_RISK_FORBIDDEN_FILES = [
  '.env',
  '.env.local',
  '.github/mcp-registry/server.json',
  'CHANGELOG.md',
  'package-lock.json',
  'package.json',
];

interface TrustMemoryEvaluation {
  status: string;
  summary: string;
  signals: string[];
  confidenceImpact: 'positive' | 'negative' | 'neutral';
  gaps: string[];
}

interface RecordProofInput {
  command: string;
  exitCode: number;
  durationMs: number;
  summary?: string;
  logPath?: string;
}

interface RunProofResult {
  command: string;
  exitCode: number;
  durationMs: number;
  outputSummary: string;
  logPath: string;
}

interface ChangedFileRule {
  kind: ProveChangedFileClassification['kind'];
  reason: string;
  matches: (input: ChangedFileClassificationInput) => boolean;
}

interface ChangedFileClassificationInput {
  file: string;
  forbidden: boolean;
  allowedProduction?: boolean;
  expectedTest?: boolean;
  contractPath?: boolean;
}

const CHANGED_FILE_RULES: ChangedFileRule[] = [
  {
    kind: 'generated',
    reason: 'Proof Contract artifact used for validation.',
    matches: (input) => Boolean(input.contractPath),
  },
  {
    kind: 'forbidden',
    reason: 'Matched forbidden Proof Contract scope.',
    matches: (input) => input.forbidden,
  },
  {
    kind: 'expected-test',
    reason: 'Expected regression test from the Proof Contract.',
    matches: (input) => Boolean(input.expectedTest),
  },
  {
    kind: 'allowed-production',
    reason: 'Allowed by the Proof Contract.',
    matches: (input) => Boolean(input.allowedProduction),
  },
  {
    kind: 'documentation',
    reason: 'Documentation change outside contract scope.',
    matches: (input) => isDocumentationPath(input.file),
  },
  {
    kind: 'generated',
    reason: 'Generated or local tool artifact changed outside contract scope.',
    matches: (input) => isGeneratedPath(input.file),
  },
  {
    kind: 'security-sensitive',
    reason: 'Security-sensitive file changed outside the Proof Contract.',
    matches: (input) => isSecuritySensitivePath(input.file),
  },
  {
    kind: 'config',
    reason: 'Configuration or release file changed outside the Proof Contract.',
    matches: (input) => isConfigPath(input.file),
  },
  {
    kind: 'unexpected-test',
    reason: 'Test file changed outside the Proof Contract.',
    matches: (input) => isTestPath(input.file),
  },
  {
    kind: 'unexpected-production',
    reason: 'Production source changed outside the Proof Contract.',
    matches: (input) => isProductionPath(input.file),
  },
];

const NEGATIVE_PROOF_OUTCOMES = new Set(['rejected', 'reverted', 'suppressed', 'noisy']);
const CONFIG_BASENAMES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'tsconfig.json',
]);
const CONFIG_SUFFIXES = ['.config.js', '.config.cjs', '.config.mjs', '.config.ts'];

export async function computeProve(
  rootPath: string,
  options: ComputeProveOptions = {},
): Promise<ProveReport> {
  const modeCount = [
    Boolean(options.intent?.trim()),
    Boolean(options.changed),
    Boolean(options.recordCommand?.trim()),
    options.runCommand !== undefined,
  ].filter(Boolean).length;
  if (modeCount > 1) {
    throw new Error('prove accepts only one of --intent, --changed, --record-command, or --run');
  }
  if (options.runCommand !== undefined) return computeRunProof(rootPath, options);
  if (options.recordCommand?.trim()) return computeRecordProof(rootPath, options);
  if (options.changed) return computeChangedProof(rootPath, options);
  return computeIntentProof(rootPath, options);
}

async function computeRunProof(
  rootPath: string,
  options: ComputeProveOptions,
): Promise<ProveReport> {
  const run = await executeProofCommand(rootPath, options.runCommand ?? [], options.runTimeoutMs);
  const changedFiles = await getChangedFiles(rootPath, options.baseRef);
  const record = await appendProofLedgerRecord(rootPath, options.ledgerPath, {
    command: run.command,
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    changedFiles: proofRelevantChangedFiles(changedFiles.files),
    outputSummary: run.outputSummary,
    logPath: run.logPath,
    source: 'prove-run',
  });
  const verdict: ProveVerdict = record.status === 'passed' ? 'ready' : 'blocked';
  const verifiedWorkflow = verifiedWorkflowForRecord(verdict, record.status);
  return {
    schemaVersion: 1,
    mode: 'run',
    verdict,
    summary: `${verdict}: executed ${record.status} proof for ${record.command}`,
    commands: [record.command],
    warnings: changedFiles.available ? [] : [changedFiles.reason ?? 'Changed-file evidence is unavailable.'],
    verifiedWorkflow,
    ledgerRecord: record,
  };
}

async function computeRecordProof(
  rootPath: string,
  options: ComputeProveOptions,
): Promise<ProveReport> {
  const proof = recordProofInput(options);
  const changedFiles = await getChangedFiles(rootPath, options.baseRef);
  const record = await appendProofLedgerRecord(rootPath, options.ledgerPath, {
    command: proof.command,
    exitCode: proof.exitCode,
    durationMs: proof.durationMs,
    changedFiles: proofRelevantChangedFiles(changedFiles.files),
    outputSummary: proof.summary,
    logPath: proof.logPath,
    source: 'prove-record',
  });
  const verdict: ProveVerdict = record.status === 'passed' ? 'ready' : 'blocked';
  const verifiedWorkflow = verifiedWorkflowForRecord(verdict, record.status);
  return {
    schemaVersion: 1,
    mode: 'record',
    verdict,
    summary: `${verdict}: recorded ${record.status} proof for ${record.command}`,
    commands: [record.command],
    warnings: changedFiles.available ? [] : [changedFiles.reason ?? 'Changed-file evidence is unavailable.'],
    verifiedWorkflow,
    ledgerRecord: record,
  };
}

function recordProofInput(options: ComputeProveOptions): RecordProofInput {
  const command = options.recordCommand?.trim();
  if (!command) throw new Error('prove --record-command requires a non-empty command');
  if (typeof options.exitCode !== 'number' || !Number.isInteger(options.exitCode)) {
    throw new Error('prove --record-command requires a numeric exit code');
  }
  if (!isNonNegativeFiniteNumber(options.durationMs)) {
    throw new Error('prove --record-command requires a non-negative duration-ms value');
  }
  return {
    command,
    exitCode: options.exitCode,
    durationMs: options.durationMs,
    summary: options.summary,
    logPath: options.logPath,
  };
}

async function executeProofCommand(
  rootPath: string,
  command: string[],
  timeoutMs: number | undefined,
): Promise<RunProofResult> {
  const commandVector = normalizeRunCommand(command);
  const displayCommand = redactProofOutput(commandVector.map(quoteShellArg).join(' '));
  const startedAtMs = Date.now();
  const effectiveTimeoutMs = resolveRunTimeoutMs(timeoutMs);
  const result = await spawnProofCommand(rootPath, commandVector, effectiveTimeoutMs);
  const durationMs = Date.now() - startedAtMs;
  const outputSummary = proofRunOutputSummary(result, effectiveTimeoutMs);
  const logPath = await writeProofRunLog(rootPath, {
    command: displayCommand,
    exitCode: result.exitCode,
    durationMs,
    stdout: result.stdout,
    stderr: result.stderr,
    errorMessage: result.errorMessage,
    timedOut: result.timedOut,
    truncated: result.truncated,
  });
  return {
    command: displayCommand,
    exitCode: result.exitCode,
    durationMs,
    outputSummary,
    logPath,
  };
}

function normalizeRunCommand(command: string[]): string[] {
  const normalized = command.map((part) => String(part));
  if (normalized.length === 0 || normalized[0]?.trim().length === 0) {
    throw new Error('prove --run requires a command after --, for example: projscan prove --run -- npm test');
  }
  return normalized;
}

function resolveRunTimeoutMs(value: number | undefined): number {
  if (value === undefined) return DEFAULT_RUN_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('prove --run-timeout-ms requires a positive number');
  }
  return Math.round(value);
}

function spawnProofCommand(
  rootPath: string,
  command: string[],
  timeoutMs: number,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  errorMessage?: string;
  timedOut: boolean;
  truncated: boolean;
}> {
  return new Promise((resolve) => {
    const [executable, ...args] = command;
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;
    let finished = false;
    let killTimer: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 1_000);
      killTimer.unref();
    }, timeoutMs);
    timeout.unref();
    const child = spawn(executable, args, {
      cwd: rootPath,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finish = (exitCode: number, errorMessage?: string): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      resolve({
        exitCode: timedOut ? PROOF_RUN_TIMEOUT_EXIT_CODE : exitCode,
        stdout,
        stderr,
        ...(errorMessage ? { errorMessage } : {}),
        timedOut,
        truncated,
      });
    };
    child.stdout?.on('data', (chunk: Buffer) => {
      const next = appendBoundedOutput(stdout, chunk);
      stdout = next.value;
      truncated ||= next.truncated;
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const next = appendBoundedOutput(stderr, chunk);
      stderr = next.value;
      truncated ||= next.truncated;
    });
    child.on('error', (error) => {
      finish(COMMAND_NOT_FOUND_EXIT_CODE, error instanceof Error ? error.message : String(error));
    });
    child.on('close', (code, signal) => {
      if (code === null) {
        finish(signal ? 1 : 0);
        return;
      }
      finish(code);
    });
  });
}

function appendBoundedOutput(
  current: string,
  chunk: Buffer,
): { value: string; truncated: boolean } {
  const text = chunk.toString('utf-8');
  const remaining = MAX_PROOF_RUN_OUTPUT_CHARS - current.length;
  if (remaining <= 0) return { value: current, truncated: text.length > 0 };
  if (text.length > remaining) {
    return { value: current + text.slice(0, remaining), truncated: true };
  }
  return { value: current + text, truncated: false };
}

function proofRunOutputSummary(
  result: {
    stdout: string;
    stderr: string;
    errorMessage?: string;
    timedOut: boolean;
    truncated: boolean;
  },
  timeoutMs: number,
): string {
  const parts = [
    result.timedOut ? `timed out after ${timeoutMs}ms` : undefined,
    result.errorMessage ? `start error: ${result.errorMessage}` : undefined,
    result.stdout.trim() ? `stdout: ${result.stdout.trim()}` : undefined,
    result.stderr.trim() ? `stderr: ${result.stderr.trim()}` : undefined,
    result.truncated ? 'output truncated' : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' | ');
}

async function writeProofRunLog(
  rootPath: string,
  input: {
    command: string;
    exitCode: number;
    durationMs: number;
    stdout: string;
    stderr: string;
    errorMessage?: string;
    timedOut: boolean;
    truncated: boolean;
  },
): Promise<string> {
  const relativePath = proofRunLogPath(input.command);
  const fullPath = path.resolve(rootPath, relativePath);
  const root = path.resolve(rootPath);
  const relativeToRoot = path.relative(root, fullPath);
  if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('Proof log path must stay inside the project root.');
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, redactedProofRunLog(input), 'utf-8');
  return relativePath;
}

function proofRunLogPath(command: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const digest = crypto.createHash('sha256').update(command).digest('hex').slice(0, 10);
  return `.projscan/proof-logs/prove-run-${stamp}-${digest}.log`;
}

function redactedProofRunLog(input: {
  command: string;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  errorMessage?: string;
  timedOut: boolean;
  truncated: boolean;
}): string {
  const raw = [
    `command: ${input.command}`,
    `exitCode: ${input.exitCode}`,
    `durationMs: ${input.durationMs}`,
    `timedOut: ${input.timedOut ? 'yes' : 'no'}`,
    `truncated: ${input.truncated ? 'yes' : 'no'}`,
    input.errorMessage ? `error: ${input.errorMessage}` : undefined,
    '--- stdout ---',
    input.stdout || '(empty)',
    '--- stderr ---',
    input.stderr || '(empty)',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
  const redacted = redactProofOutput(raw);
  return `${truncateText(redacted, MAX_PROOF_RUN_LOG_CHARS)}\n`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 24)}\n[projscan log truncated]\n`;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

async function computeIntentProof(
  rootPath: string,
  options: ComputeProveOptions,
): Promise<ProveReport> {
  const intent = normalizeIntent(options.intent);
  if (!intent) throw new Error('prove --intent requires a non-empty change intent');

  const [simulation, trustMemory] = await Promise.all([
    computeSimulation(rootPath, {
      plan: intent,
      maxFiles: options.maxFiles,
    }),
    readTrustMemory(options.feedbackPath),
  ]);

  const contract = buildContract({ intent, simulation, trustMemory });
  let savedContractPath: string | undefined;
  if (options.saveContractPath) {
    savedContractPath = await writeContract(rootPath, options.saveContractPath, contract);
  }

  return {
    schemaVersion: 1,
    mode: 'intent',
    verdict: intentVerdict(contract),
    summary: `ready: Proof Contract ${contract.id} constrains ${contract.allowedFiles.length} file(s) and requires ${contract.proofCommands.length} proof command(s).`,
    contract,
    commands: contract.proofCommands,
    warnings: simulation.warnings,
    verifiedWorkflow: contract.verifiedWorkflow,
    ...(savedContractPath ? { savedContractPath } : {}),
  };
}

async function computeChangedProof(
  rootPath: string,
  options: ComputeProveOptions,
): Promise<ProveReport> {
  const [contract, changedFiles, ledger] = await Promise.all([
    resolveContract(rootPath, options),
    getChangedFiles(rootPath, options.baseRef),
    readProofLedger(rootPath, options.ledgerPath),
  ]);
  const quickPreflight = quickProofPreflight(changedFiles);
  const receipt = buildReceipt({
    contract: contract.contract,
    contractPath: contract.path,
    changedFiles: changedFiles.files,
    changedFilesAvailable: changedFiles.available,
    changedFilesReason: changedFiles.reason,
    riskDelta: contract.contract?.riskDelta ?? fallbackRiskDelta(),
    newRisks: quickPreflight.risks,
    preflightVerdict: quickPreflight.verdict,
    ledger,
  });

  return {
    schemaVersion: 1,
    mode: 'changed',
    verdict: receipt.commitReadiness,
    summary: receipt.summary,
    ...(contract.contract ? { contract: contract.contract } : {}),
    receipt,
    commands: receipt.proofStatus.commandsRequired,
    warnings: receipt.evidenceGaps,
    verifiedWorkflow: receipt.verifiedWorkflow,
  };
}

function quickProofPreflight(changedFiles: Awaited<ReturnType<typeof getChangedFiles>>): {
  verdict: 'proceed' | 'caution' | 'block';
  risks: string[];
} {
  if (!changedFiles.available) {
    return {
      verdict: 'caution',
      risks: [changedFiles.reason ?? 'Changed-file evidence is unavailable.'],
    };
  }
  if (changedFiles.files.length > 50) {
    return {
      verdict: 'caution',
      risks: [`${changedFiles.files.length} changed files exceeds the proof replay focus threshold of 50.`],
    };
  }
  return {
    verdict: 'proceed',
    risks: [],
  };
}

function buildContract(input: {
  intent: string;
  simulation: Awaited<ReturnType<typeof computeSimulation>>;
  trustMemory?: Awaited<ReturnType<typeof readTrustMemory>>;
}): ProveContract {
  const simulationFiles = input.simulation.filesLikelyTouched.map((file) => file.path);
  const allowedFiles = unique(simulationFiles);
  const likelyTests = unique(input.simulation.testsLikelyAffected);
  const forbiddenFiles = forbiddenFilesFor(input.intent, [...allowedFiles, ...likelyTests]);
  const proofCommands = contractProofCommands(input.simulation.proofCommands);
  const evidenceGaps = unique([
    ...(input.simulation.warnings.length > 0 ? input.simulation.warnings : []),
    ...(likelyTests.length === 0 ? ['No likely regression test was inferred from the plan.'] : []),
    ...(input.trustMemory?.gaps ?? []),
  ]);
  const confidence = confidenceForTrustMemory(input.simulation.confidence, input.trustMemory);
  const contract: Omit<ProveContract, 'verifiedWorkflow'> = {
    schemaVersion: 1,
    id: `proof-contract-${slug(input.intent)}`,
    intent: input.intent,
    createdAt: new Date().toISOString(),
    allowedFiles,
    forbiddenFiles,
    riskyContracts: riskyContractsFor(input.simulation.contractsLikelyAffected, allowedFiles),
    likelyTests,
    missingRegressionTests:
      likelyTests.length > 0 ? [] : ['Add one regression test around the behavior named by the intent.'],
    proofCommands,
    safeChangeShape: safeChangeShape(input.simulation.recommendedAlternative.summary),
    rollbackPlan: rollbackPlan([...allowedFiles, ...likelyTests]),
    confidence,
    confidenceReason: confidenceReasonForSimulation(
      confidence,
      input.simulation.confidence,
      input.trustMemory,
    ),
    evidenceStrength: {
      level: input.simulation.evidence.length > 1 ? 'moderate' : 'thin',
      score: Math.min(80, input.simulation.evidence.length * 15),
      sources: unique(input.simulation.evidence.map((entry) => entry.source)),
      gaps: evidenceGaps,
    },
    trustMemory: {
      status: input.trustMemory?.status ?? 'none',
      summary: input.trustMemory?.summary ?? 'No local trust-memory artifact was applied.',
      signals: input.trustMemory?.signals ?? [],
    },
    reviewerGuidance:
      'Review scope first, then require the listed proof commands before approving commit or handoff.',
    receiptCommand: `projscan prove --changed --contract ${quoteShellArg(DEFAULT_CONTRACT_PATH)} --format markdown`,
    riskDelta: input.simulation.riskDelta,
  };
  return {
    ...contract,
    verifiedWorkflow: verifiedWorkflowForContract(contract),
  };
}

function contractProofCommands(simulationCommands: string[]): string[] {
  return unique([
    simulationCommands.find((command) => command.startsWith('projscan simulate ')),
    simulationCommands.find((command) => /^npm (?:run )?test\b/.test(command)),
    'projscan assess --mode fix-first --format json',
    'projscan preflight --mode before_commit --format json',
  ].filter((command): command is string => typeof command === 'string'));
}

function buildReceipt(input: {
  contract?: ProveContract;
  contractPath?: string;
  changedFiles: string[];
  changedFilesAvailable: boolean;
  changedFilesReason?: string;
  riskDelta: RiskDeltaSnapshot;
  newRisks: string[];
  preflightVerdict: 'proceed' | 'caution' | 'block';
  ledger: Awaited<ReturnType<typeof readProofLedger>>;
}): ProveReceipt {
  const scope = scopeFor(input.contract, input.contractPath, input.changedFiles);
  const evidenceGaps = evidenceGapsFor(input);
  const proofCommands = input.contract?.proofCommands ?? [
    'projscan assess --mode fix-first --format json',
    'projscan preflight --mode before_commit --format json',
  ];
  const proofStatus = proofStatusFor(proofCommands, input.ledger, input.changedFiles);
  const commitReadiness = readinessFor({
    scopeStatus: scope.status,
    forbiddenTouched: scope.forbiddenTouched,
    preflightVerdict: input.preflightVerdict,
    evidenceGaps,
    proofStatus: proofStatus.status,
  });
  const riskDeltaDirection = riskDeltaDirectionFor(input.riskDelta);
  const reviewerDecision = reviewerDecisionFor({
    commitReadiness,
    proofStatus: proofStatus.status,
    scope,
    preflightVerdict: input.preflightVerdict,
  });
  const receipt: Omit<ProveReceipt, 'verifiedWorkflow'> = {
    summary: summaryForReceipt(commitReadiness, scope),
    commitReadiness,
    scope,
    proofStatus,
    riskDelta: input.riskDelta,
    riskDeltaDirection,
    reviewerDecision,
    newRisks: input.newRisks,
    evidenceGaps,
    reviewerGuidance: reviewerGuidanceFor(commitReadiness, scope, reviewerDecision, proofStatus.status),
  };
  return {
    ...receipt,
    verifiedWorkflow: verifiedWorkflowForReceipt(receipt),
  };
}

function verifiedWorkflowForContract(
  contract: Omit<ProveContract, 'verifiedWorkflow'>,
): ProveVerifiedWorkflow {
  return {
    phase: 'contract',
    status: intentVerdict(contract),
    nextAction: 'save the Proof Contract, make the bounded edit, then record proof commands',
    nextCommand: contract.receiptCommand,
    staleProof: false,
    missingProof: contract.proofCommands.length > 0,
    failedProof: false,
  };
}

function verifiedWorkflowForRecord(
  verdict: ProveVerdict,
  recordStatus: 'passed' | 'failed',
): ProveVerifiedWorkflow {
  const failedProof = recordStatus === 'failed';
  return {
    phase: 'record',
    status: verdict,
    nextAction: failedProof
      ? 'fix the failed proof command, record it again, then replay changed proof'
      : 'run projscan prove --changed to replay the ledger against the current diff',
    nextCommand: 'projscan prove --changed --format markdown',
    staleProof: false,
    missingProof: false,
    failedProof,
  };
}

function verifiedWorkflowForReceipt(
  receipt: Omit<ProveReceipt, 'verifiedWorkflow'>,
): ProveVerifiedWorkflow {
  const proofStatus = receipt.proofStatus.status;
  const staleProof = proofStatus === 'stale' || receipt.proofStatus.staleCommands.length > 0;
  const missingProof =
    proofStatus === 'missing' ||
    proofStatus === 'partial' ||
    receipt.proofStatus.missingCommands.length > 0;
  const failedProof = proofStatus === 'failed' || receipt.proofStatus.failedCommands.length > 0;
  return {
    phase: 'receipt',
    status: receipt.commitReadiness,
    nextAction: nextActionForReceipt({
      receipt,
      staleProof,
      missingProof,
      failedProof,
    }),
    nextCommand: nextCommandForReceipt({
      receipt,
      staleProof,
      missingProof,
      failedProof,
    }),
    reviewerDecision: receipt.reviewerDecision,
    scopeStatus: receipt.scope.status,
    proofStatus,
    riskDeltaDirection: receipt.riskDeltaDirection,
    staleProof,
    missingProof,
    failedProof,
  };
}

function nextActionForReceipt(input: {
  receipt: Omit<ProveReceipt, 'verifiedWorkflow'>;
  staleProof: boolean;
  missingProof: boolean;
  failedProof: boolean;
}): string {
  if (input.failedProof) return 'fix failed proof commands before review';
  if (input.staleProof) return 'rerun stale proof commands before review';
  if (input.missingProof) return 'record missing proof commands before review';
  if (input.receipt.scope.status === 'drifted') {
    return 'resolve scope drift or update the Proof Contract before review';
  }
  if (input.receipt.reviewerDecision === 'safe-to-review') {
    return 'share the Proof Receipt with the reviewer';
  }
  return 'review focused scope and proof gaps before approval';
}

function nextCommandForReceipt(input: {
  receipt: Omit<ProveReceipt, 'verifiedWorkflow'>;
  staleProof: boolean;
  missingProof: boolean;
  failedProof: boolean;
}): string {
  if (input.failedProof) {
    return `projscan prove --record-command ${quoteShellArg(
      input.receipt.proofStatus.failedCommands[0] ?? '<command>',
    )} --exit-code 0 --duration-ms <ms>`;
  }
  if (input.staleProof) {
    return `projscan prove --record-command ${quoteShellArg(
      input.receipt.proofStatus.staleCommands[0] ?? '<command>',
    )} --exit-code 0 --duration-ms <ms>`;
  }
  if (input.missingProof) {
    return 'projscan prove --record-command "<command>" --exit-code 0 --duration-ms <ms>';
  }
  if (input.receipt.scope.status === 'drifted') return 'projscan prove --changed --format markdown';
  return 'projscan evidence-pack --pr-comment';
}

function proofStatusFor(
  proofCommands: string[],
  ledger: Awaited<ReturnType<typeof readProofLedger>>,
  changedFiles: string[],
): ProveReceipt['proofStatus'] {
  const relevantChangedFiles = proofRelevantChangedFiles(changedFiles);
  const currentFingerprint = changedFileFingerprint(relevantChangedFiles);
  const commandEvidence = proofCommands.map((command): ProveProofCommandEvidence => {
    const record = latestProofRecordFor(ledger, command);
    if (!record) {
      return {
        command,
        status: 'missing',
        fresh: false,
      };
    }
    const fresh = record.changedFileFingerprint === currentFingerprint;
    if (!fresh) {
      return {
        command,
        status: 'stale',
        fresh: false,
        exitCode: record.exitCode,
        durationMs: record.durationMs,
        completedAt: record.completedAt,
        outputSummary: record.outputSummary,
        ...(record.logPath ? { logPath: record.logPath } : {}),
        staleReason: 'Recorded changed files differ from current changed files.',
      };
    }
    return {
      command,
      status: record.exitCode === 0 ? 'passed' : 'failed',
      fresh: true,
      exitCode: record.exitCode,
      durationMs: record.durationMs,
      completedAt: record.completedAt,
      outputSummary: record.outputSummary,
      ...(record.logPath ? { logPath: record.logPath } : {}),
    };
  });
  const missingCommands = commandEvidence
    .filter((entry) => entry.status === 'missing')
    .map((entry) => entry.command);
  const failedCommands = commandEvidence
    .filter((entry) => entry.status === 'failed')
    .map((entry) => entry.command);
  const staleCommands = commandEvidence
    .filter((entry) => entry.status === 'stale')
    .map((entry) => entry.command);
  const commandsRun = commandEvidence
    .filter((entry) => typeof entry.exitCode === 'number')
    .map((entry) => entry.command);
  const status = proofStatusSummary({
    requiredCount: proofCommands.length,
    missingCount: missingCommands.length,
    failedCount: failedCommands.length,
    staleCount: staleCommands.length,
  });

  return {
    status,
    commandsRequired: proofCommands,
    commandsRun,
    missingCommands,
    failedCommands,
    staleCommands,
    commandEvidence,
  };
}

function proofStatusSummary(input: {
  requiredCount: number;
  missingCount: number;
  failedCount: number;
  staleCount: number;
}): ProveReceipt['proofStatus']['status'] {
  if (input.requiredCount === 0) return 'not-run';
  if (input.failedCount > 0) return 'failed';
  if (input.staleCount === input.requiredCount) return 'stale';
  if (input.missingCount === input.requiredCount) return 'missing';
  if (input.staleCount > 0 || input.missingCount > 0) return 'partial';
  return 'passed';
}

function proofRelevantChangedFiles(files: string[]): string[] {
  return files.filter((file) => !isGeneratedPath(file));
}

function scopeFor(
  contract: ProveContract | undefined,
  contractPath: string | undefined,
  changedFiles: string[],
): ProveReceipt['scope'] {
  if (!contract) {
    const classifications = changedFiles.map((file) =>
      classifyChangedFile({ file, forbidden: false }),
    );
    return {
      status: 'missing-contract',
      changedFiles,
      allowedTouched: [],
      forbiddenTouched: [],
      outsideAllowed: changedFiles,
      classifications,
      ...classificationBuckets(classifications),
      ...(contractPath ? { contractPath } : {}),
    };
  }
  const allowed = new Set([
    ...contract.allowedFiles,
    ...contract.likelyTests,
    ...(contractPath ? [contractPath] : []),
  ]);
  const forbiddenTouched = changedFiles.filter((file) =>
    contract.forbiddenFiles.some((pattern) => pathMatches(file, pattern)),
  );
  const allowedTouched = changedFiles.filter((file) => allowed.has(file));
  const outsideAllowed = changedFiles.filter((file) => !allowed.has(file) && !isLocalProofArtifactPath(file));
  const classifications = changedFiles.map((file) =>
    classifyChangedFile({
      file,
      forbidden: forbiddenTouched.includes(file),
      allowedProduction: contract.allowedFiles.includes(file),
      expectedTest: contract.likelyTests.includes(file),
      contractPath: contractPath === file,
    }),
  );
  const status: ProveScopeStatus =
    forbiddenTouched.length > 0 || outsideAllowed.length > 0 ? 'drifted' : 'within-contract';
  return {
    status,
    changedFiles,
    allowedTouched,
    forbiddenTouched,
    outsideAllowed,
    classifications,
    ...classificationBuckets(classifications),
    ...(contractPath ? { contractPath } : {}),
  };
}

async function resolveContract(
  rootPath: string,
  options: ComputeProveOptions,
): Promise<{ contract?: ProveContract; path?: string }> {
  if (options.contract) return { contract: options.contract };
  if (options.contractPath) {
    return {
      contract: await readContract(rootPath, options.contractPath, true),
      path: options.contractPath,
    };
  }
  const contract = await readContract(rootPath, DEFAULT_CONTRACT_PATH, false);
  return contract ? { contract, path: DEFAULT_CONTRACT_PATH } : {};
}

async function readContract(
  rootPath: string,
  filePath: string,
  required: boolean,
): Promise<ProveContract | undefined> {
  const fullPath = path.resolve(rootPath, filePath);
  try {
    const parsed = JSON.parse(await fs.readFile(fullPath, 'utf-8')) as Partial<ProveContract>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.allowedFiles) || !parsed.id) {
      throw new Error('invalid Proof Contract shape');
    }
    return parsed as ProveContract;
  } catch (error) {
    if (!required && isNodeErrorCode(error, 'ENOENT')) return undefined;
    throw new Error(
      `Could not read Proof Contract ${filePath}: ${
        error instanceof Error ? error.message : 'invalid JSON'
      }`,
      { cause: error },
    );
  }
}

async function writeContract(
  rootPath: string,
  filePath: string,
  contract: ProveContract,
): Promise<string> {
  const fullPath = path.resolve(rootPath, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf-8');
  return filePath;
}

function forbiddenFilesFor(intent: string, allowed: string[]): string[] {
  const intentLower = intent.toLowerCase();
  const allowedSet = new Set(allowed);
  return unique([...GENERATED_FORBIDDEN_PATTERNS, ...HIGH_RISK_FORBIDDEN_FILES]).filter((file) => {
    if (allowedSet.has(file)) return false;
    if (!file.includes('*') && intentLower.includes(file.toLowerCase())) return false;
    return true;
  });
}

function riskyContractsFor(inferred: string[], allowedFiles: string[]): string[] {
  const contracts = new Set(inferred);
  if (allowedFiles.some((file) => file.startsWith('src/cli/'))) contracts.add('CLI command surface');
  if (allowedFiles.some((file) => file.startsWith('src/mcp/'))) contracts.add('MCP tool surface');
  if (allowedFiles.some((file) => file.includes('/types') || file === 'src/types.ts'))
    contracts.add('public API/types');
  return [...contracts].sort();
}

function evidenceGapsFor(input: {
  contract?: ProveContract;
  changedFilesAvailable: boolean;
  changedFilesReason?: string;
  preflightVerdict: 'proceed' | 'caution' | 'block';
}): string[] {
  const gaps: string[] = [];
  if (!input.contract) {
    gaps.push(`No Proof Contract was supplied or found at ${DEFAULT_CONTRACT_PATH}.`);
  } else {
    gaps.push(...input.contract.evidenceStrength.gaps);
  }
  if (!input.changedFilesAvailable) {
    gaps.push(input.changedFilesReason ?? 'Changed-file evidence is unavailable.');
  }
  if (input.preflightVerdict === 'block') {
    gaps.push('Preflight returned block for the current working tree.');
  }
  return unique(gaps);
}

function readinessFor(input: {
  scopeStatus: ProveScopeStatus;
  forbiddenTouched: string[];
  preflightVerdict: 'proceed' | 'caution' | 'block';
  evidenceGaps: string[];
  proofStatus: ProveReceipt['proofStatus']['status'];
}): ProveVerdict {
  if (hasBlockingReceiptSignal(input)) return 'blocked';
  return hasReviewReceiptSignal(input) ? 'needs-review' : 'ready';
}

function hasBlockingReceiptSignal(input: {
  forbiddenTouched: string[];
  preflightVerdict: 'proceed' | 'caution' | 'block';
  proofStatus: ProveReceipt['proofStatus']['status'];
}): boolean {
  return input.forbiddenTouched.length > 0 || input.preflightVerdict === 'block' || input.proofStatus === 'failed';
}

function hasReviewReceiptSignal(input: {
  scopeStatus: ProveScopeStatus;
  preflightVerdict: 'proceed' | 'caution' | 'block';
  evidenceGaps: string[];
  proofStatus: ProveReceipt['proofStatus']['status'];
}): boolean {
  return (
    input.scopeStatus !== 'within-contract' ||
    isIncompleteProofStatus(input.proofStatus) ||
    input.preflightVerdict === 'caution' ||
    input.evidenceGaps.length > 0
  );
}

function isIncompleteProofStatus(status: ProveReceipt['proofStatus']['status']): boolean {
  return status === 'missing' || status === 'partial' || status === 'stale';
}

function riskDeltaDirectionFor(riskDelta: RiskDeltaSnapshot): ProveRiskDeltaDirection {
  if (riskDelta.delta > 0) return 'improved';
  if (riskDelta.delta < 0) return 'worse';
  return 'flat';
}

function reviewerDecisionFor(input: {
  commitReadiness: ProveVerdict;
  proofStatus: ProveReceipt['proofStatus']['status'];
  scope: ProveReceipt['scope'];
  preflightVerdict: 'proceed' | 'caution' | 'block';
}): ProveReviewerDecision {
  if (input.commitReadiness === 'blocked' || input.proofStatus === 'failed') return 'stop';
  if (
    input.commitReadiness === 'ready' &&
    input.proofStatus === 'passed' &&
    input.scope.status === 'within-contract' &&
    input.preflightVerdict === 'proceed'
  ) {
    return 'safe-to-review';
  }
  return 'needs-focused-review';
}

function reviewerGuidanceFor(
  verdict: ProveVerdict,
  scope: ProveReceipt['scope'],
  reviewerDecision: ProveReviewerDecision,
  proofStatus: ProveReceipt['proofStatus']['status'],
): string {
  return firstMatchingGuidance([
    [reviewerDecision === 'stop', 'Stop this proof slice until failed proof commands, forbidden files, or preflight blockers are cleared.'],
    [proofStatus === 'stale', 'Rerun the required proof commands; the ledger evidence is stale after newer file changes.'],
    [isIncompleteProofStatus(proofStatus), 'Record fresh proof-command evidence before approval. Missing or partial proof should not be treated as reviewer-ready.'],
    [verdict === 'blocked', 'Do not approve until forbidden files or preflight blockers are removed from this proof slice.'],
    [scope.unexpectedProduction.length > 0, 'Review the unexpected production files first. Either update the Proof Contract intentionally or split those edits out.'],
    [hasSensitiveScopeDrift(scope), 'Require explicit reviewer sign-off for config or security-sensitive drift before approving.'],
    [hasDocsOnlyScopeDrift(scope), 'Documentation drift is the only scope issue. Confirm it explains the same proof slice, then require proof-command evidence.'],
    [verdict === 'ready', 'Scope is inside the Proof Contract. Require proof-command evidence before final approval.'],
  ]);
}

function firstMatchingGuidance(checks: Array<[boolean, string]>): string {
  return (
    checks.find(([matches]) => matches)?.[1] ??
    'Do not approve until scope drift, missing contract evidence, or preflight blockers are resolved.'
  );
}

function hasSensitiveScopeDrift(scope: ProveReceipt['scope']): boolean {
  return scope.configTouched.length > 0 || scope.securitySensitiveTouched.length > 0;
}

function hasDocsOnlyScopeDrift(scope: ProveReceipt['scope']): boolean {
  return scope.documentationTouched.length > 0 && scope.outsideAllowed.length === scope.documentationTouched.length;
}

function summaryForReceipt(verdict: ProveVerdict, scope: ProveReceipt['scope']): string {
  if (scope.forbiddenTouched.length > 0) {
    return `${verdict}: forbidden file(s) touched: ${scope.forbiddenTouched.join(', ')}`;
  }
  if (scope.status === 'missing-contract') {
    return `${verdict}: no Proof Contract was applied to ${scope.changedFiles.length} changed file(s)`;
  }
  if (scope.unexpectedProduction.length > 0) {
    return `${verdict}: production file(s) outside the Proof Contract: ${scope.unexpectedProduction.join(', ')}`;
  }
  if (scope.securitySensitiveTouched.length > 0) {
    return `${verdict}: security-sensitive file(s) need explicit review`;
  }
  if (scope.configTouched.length > 0) {
    return `${verdict}: config file(s) need explicit review`;
  }
  if (scope.status === 'drifted') {
    return `${verdict}: ${scope.outsideAllowed.length} changed file(s) outside the Proof Contract`;
  }
  return `${verdict}: ${scope.changedFiles.length} changed file(s) stay inside the Proof Contract`;
}

function classifyChangedFile(input: ChangedFileClassificationInput): ProveChangedFileClassification {
  const rule = CHANGED_FILE_RULES.find((candidate) => candidate.matches(input));
  return {
    file: input.file,
    kind: rule?.kind ?? 'unknown',
    reason: rule?.reason ?? 'Changed file is outside the Proof Contract and could not be classified.',
  };
}

function classificationBuckets(
  classifications: ProveChangedFileClassification[],
): Pick<
  ProveReceipt['scope'],
  | 'allowedProduction'
  | 'expectedTests'
  | 'unexpectedProduction'
  | 'unexpectedTests'
  | 'documentationTouched'
  | 'configTouched'
  | 'securitySensitiveTouched'
  | 'generatedTouched'
> {
  return {
    allowedProduction: filesByKind(classifications, 'allowed-production'),
    expectedTests: filesByKind(classifications, 'expected-test'),
    unexpectedProduction: filesByKind(classifications, 'unexpected-production'),
    unexpectedTests: filesByKind(classifications, 'unexpected-test'),
    documentationTouched: classifications
      .filter((entry) => entry.kind === 'documentation' || isDocumentationPath(entry.file))
      .map((entry) => entry.file),
    configTouched: classifications
      .filter((entry) => entry.kind === 'config' || isConfigPath(entry.file))
      .map((entry) => entry.file),
    securitySensitiveTouched: classifications
      .filter((entry) => entry.kind === 'security-sensitive' || isSecuritySensitivePath(entry.file))
      .map((entry) => entry.file),
    generatedTouched: classifications
      .filter((entry) => entry.kind === 'generated' || isGeneratedPath(entry.file))
      .map((entry) => entry.file),
  };
}

function filesByKind(
  classifications: ProveChangedFileClassification[],
  kind: ProveChangedFileClassification['kind'],
): string[] {
  return classifications.filter((entry) => entry.kind === kind).map((entry) => entry.file);
}

async function readTrustMemory(
  feedbackPath: string | undefined,
): Promise<TrustMemoryEvaluation | undefined> {
  if (!feedbackPath) return undefined;
  try {
    const feedback = await readFeedbackFile(feedbackPath);
    return evaluateTrustMemoryResponses(feedback.responses.slice(0, 5));
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return undefined;
    throw error;
  }
}

function evaluateTrustMemoryResponses(
  responses: Awaited<ReturnType<typeof readFeedbackFile>>['responses'],
): TrustMemoryEvaluation {
  if (responses.length === 0) return emptyTrustMemoryEvaluation();
  const signals = trustMemorySignals(responses);
  const counts = trustMemorySignalCounts(responses, signals);
  const confidenceImpact = trustMemoryConfidenceImpact(counts);
  return {
    status: trustMemoryStatus(confidenceImpact),
    summary: `${responses.length} local feedback response(s) applied to contract confidence.`,
    signals: trustMemorySignalLabels(responses, signals),
    confidenceImpact,
    gaps: trustMemoryGaps(confidenceImpact, counts.negativeProofOutcomeCount),
  };
}

function emptyTrustMemoryEvaluation(): TrustMemoryEvaluation {
  return {
    status: 'none',
    summary: 'Feedback artifact has no recorded responses.',
    signals: [],
    confidenceImpact: 'neutral',
    gaps: [],
  };
}

function trustMemorySignals(responses: Awaited<ReturnType<typeof readFeedbackFile>>['responses']) {
  const proofOutcomes = unique(
    responses
      .map((response) => response.proofOutcome)
      .filter((outcome): outcome is NonNullable<typeof outcome> => Boolean(outcome)),
  );
  return {
    missingSignals: unique(responses.flatMap((response) => response.missingSignals ?? [])),
    noisyFindings: unique(responses.flatMap((response) => response.noisyFindings ?? [])),
    falsePositiveRules: unique(responses.flatMap((response) => response.falsePositiveRules ?? [])),
    proofOutcomes,
    negativeProofOutcomeCount: proofOutcomes.filter(isNegativeProofOutcome).length,
  };
}

function trustMemorySignalCounts(
  responses: Awaited<ReturnType<typeof readFeedbackFile>>['responses'],
  signals: ReturnType<typeof trustMemorySignals>,
): { positive: number; negative: number; negativeProofOutcomeCount: number } {
  return {
    positive: positiveTrustSignalCount(responses),
    negative:
      responses.filter((response) => response.useful === false).length +
      signals.missingSignals.length +
      signals.noisyFindings.length +
      signals.falsePositiveRules.length +
      signals.negativeProofOutcomeCount,
    negativeProofOutcomeCount: signals.negativeProofOutcomeCount,
  };
}

function positiveTrustSignalCount(
  responses: Awaited<ReturnType<typeof readFeedbackFile>>['responses'],
): number {
  return (
    responses.filter((response) => response.useful === true).length +
    responses.filter((response) => response.proofOutcome === 'accepted').length +
    responses.filter((response) => response.preventedBadEdit === true).length +
    responses.filter((response) => response.ownerRoutingClear === true).length +
    responses.filter((response) => response.nextCommandClear === true).length
  );
}

function trustMemoryConfidenceImpact(counts: {
  positive: number;
  negative: number;
}): TrustMemoryEvaluation['confidenceImpact'] {
  if (counts.negative > counts.positive) return 'negative';
  return counts.positive > 0 ? 'positive' : 'neutral';
}

function trustMemoryStatus(confidenceImpact: TrustMemoryEvaluation['confidenceImpact']): string {
  if (confidenceImpact === 'negative') return 'needs-tuning';
  return confidenceImpact === 'positive' ? 'trusted' : 'mixed';
}

function trustMemoryGaps(
  confidenceImpact: TrustMemoryEvaluation['confidenceImpact'],
  negativeProofOutcomeCount: number,
): string[] {
  if (confidenceImpact !== 'negative') return [];
  return [
    negativeProofOutcomeCount > 0
      ? 'Trust Memory reports rejected, reverted, suppressed, or noisy proof outcomes for similar workflows.'
      : 'Trust Memory reports missing signals or noisy findings for similar proof workflows.',
  ];
}

function trustMemorySignalLabels(
  responses: Awaited<ReturnType<typeof readFeedbackFile>>['responses'],
  signals: ReturnType<typeof trustMemorySignals>,
): string[] {
  return unique([
    ...responses.map(trustMemoryResponseLabel),
    ...signals.missingSignals.map((signal) => `missing signal: ${signal}`),
    ...signals.noisyFindings.map((finding) => `noisy finding: ${finding}`),
    ...signals.falsePositiveRules.map((rule) => `false positive: ${rule}`),
    ...signals.proofOutcomes.map((outcome) => `proof outcome: ${outcome}`),
  ]);
}

function trustMemoryResponseLabel(
  response: Awaited<ReturnType<typeof readFeedbackFile>>['responses'][number],
): string {
  const repo = response.repo ?? 'unknown repo';
  const pr = response.pr ? ` PR ${response.pr}` : '';
  const useful = response.useful === false ? 'not useful' : response.useful === true ? 'useful' : 'feedback';
  return `${useful}: ${repo}${pr}`;
}

function isNegativeProofOutcome(outcome: string): boolean {
  return NEGATIVE_PROOF_OUTCOMES.has(outcome);
}

function fallbackRiskDelta(): RiskDeltaSnapshot {
  return {
    baselineScore: 0,
    projectedScore: 0,
    delta: 0,
    basis: ['No saved Proof Contract risk delta was available.'],
  };
}

function safeChangeShape(summary: string): string {
  if (summary.toLowerCase().includes('bounded')) {
    return `${summary} Keep the edit bounded to allowed files and likely tests.`;
  }
  return `Use a bounded change: ${summary}`;
}

function rollbackPlan(files: string[]): string {
  if (files.length === 0) return 'Run git restore . to roll back this proof slice.';
  return `Run git restore ${files.map(quoteShellArg).join(' ')} to roll back this proof slice.`;
}

function intentVerdict(contract: Pick<ProveContract, 'confidence'>): ProveVerdict {
  return contract.confidence === 'low' ? 'needs-review' : 'ready';
}

function confidenceForTrustMemory(
  confidence: AssessConfidence,
  trustMemory: TrustMemoryEvaluation | undefined,
): AssessConfidence {
  if (trustMemory?.confidenceImpact === 'negative') return lowerConfidence(confidence);
  if (trustMemory?.confidenceImpact === 'positive') return raiseConfidence(confidence);
  return confidence;
}

function lowerConfidence(confidence: AssessConfidence): AssessConfidence {
  if (confidence === 'high') return 'medium';
  if (confidence === 'medium') return 'low';
  return 'low';
}

function raiseConfidence(confidence: AssessConfidence): AssessConfidence {
  if (confidence === 'low') return 'medium';
  if (confidence === 'medium') return 'high';
  return 'high';
}

function confidenceReasonForSimulation(
  confidence: AssessConfidence,
  simulationConfidence: AssessConfidence,
  trustMemory: TrustMemoryEvaluation | undefined,
): string {
  if (trustMemory?.confidenceImpact === 'negative') {
    return `Trust Memory lowered confidence from ${simulationConfidence} to ${confidence} because local feedback reported missing signals or noisy findings.`;
  }
  if (trustMemory?.confidenceImpact === 'positive') {
    return `Trust Memory raised confidence from ${simulationConfidence} to ${confidence} because local feedback marked similar proof workflows useful.`;
  }
  return `${confidence} confidence from local simulation evidence.`;
}

function normalizeIntent(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function isDocumentationPath(file: string): boolean {
  return (
    file === 'README.md' ||
    file.startsWith('docs/') ||
    file.endsWith('.md') ||
    file.endsWith('.mdx')
  );
}

function isGeneratedPath(file: string): boolean {
  return (
    file.startsWith('.projscan/') ||
    file.startsWith('.projscan-memory/') ||
    file.startsWith('.agentloop/') ||
    file.startsWith('.agentflight/') ||
    file.startsWith('coverage/') ||
    file.startsWith('dist/')
  );
}

function isLocalProofArtifactPath(file: string): boolean {
  return file.startsWith('.projscan/');
}

function isSecuritySensitivePath(file: string): boolean {
  return (
    file === '.env' ||
    file.startsWith('.env.') ||
    file.includes('/auth') ||
    file.includes('/security') ||
    file.includes('/secrets') ||
    file.endsWith('.pem') ||
    file.endsWith('.key')
  );
}

function isConfigPath(file: string): boolean {
  const basename = path.posix.basename(file);
  return (
    CONFIG_BASENAMES.has(basename) ||
    CONFIG_SUFFIXES.some((suffix) => basename.endsWith(suffix)) ||
    file.startsWith('.github/')
  );
}

function isTestPath(file: string): boolean {
  return (
    file.startsWith('test/') ||
    file.startsWith('tests/') ||
    file.includes('/__tests__/') ||
    /\.test\.[cm]?[jt]sx?$/.test(file) ||
    /\.spec\.[cm]?[jt]sx?$/.test(file)
  );
}

function isProductionPath(file: string): boolean {
  return (
    file.startsWith('src/') ||
    file.startsWith('app/') ||
    file.startsWith('lib/') ||
    file.startsWith('packages/') ||
    file.startsWith('apps/')
  );
}

function pathMatches(file: string, pattern: string): boolean {
  if (pattern.endsWith('/**')) return file.startsWith(pattern.slice(0, -3));
  return file === pattern;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
