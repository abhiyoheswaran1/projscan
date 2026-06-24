import type { AssessConfidence, AssessEvidenceStrengthLevel, RiskDeltaSnapshot } from './assess.js';
import type { ProofLedgerRecord } from './proofLedger.js';

export type ProveMode = 'intent' | 'changed' | 'record' | 'run';
export type ProveVerdict = 'ready' | 'needs-review' | 'blocked';
export type ProveScopeStatus = 'within-contract' | 'drifted' | 'missing-contract';
export type ProveProofStatus = 'not-run' | 'missing' | 'partial' | 'passed' | 'failed' | 'stale';
export type ProveRiskDeltaDirection = 'improved' | 'worse' | 'flat';
export type ProveReviewerDecision = 'safe-to-review' | 'needs-focused-review' | 'stop';
export type ProveProofCommandStatus = 'passed' | 'failed' | 'missing' | 'stale';
export type ProveChangedFileKind =
  | 'allowed-production'
  | 'expected-test'
  | 'documentation'
  | 'config'
  | 'security-sensitive'
  | 'generated'
  | 'forbidden'
  | 'unexpected-production'
  | 'unexpected-test'
  | 'unknown';

export interface ProveTrustMemorySummary {
  status: string;
  summary: string;
  signals: string[];
}

export interface ProveVerifiedWorkflow {
  phase: 'contract' | 'receipt' | 'record';
  status: ProveVerdict;
  nextAction: string;
  nextCommand: string;
  reviewerDecision?: ProveReviewerDecision;
  scopeStatus?: ProveScopeStatus;
  proofStatus?: ProveProofStatus;
  riskDeltaDirection?: ProveRiskDeltaDirection;
  staleProof: boolean;
  missingProof: boolean;
  failedProof: boolean;
}

export interface ProveChangedFileClassification {
  file: string;
  kind: ProveChangedFileKind;
  reason: string;
}

export interface ProveContract {
  schemaVersion: 1;
  id: string;
  intent: string;
  createdAt: string;
  allowedFiles: string[];
  forbiddenFiles: string[];
  riskyContracts: string[];
  likelyTests: string[];
  missingRegressionTests: string[];
  proofCommands: string[];
  safeChangeShape: string;
  rollbackPlan: string;
  confidence: AssessConfidence;
  confidenceReason: string;
  evidenceStrength: {
    level: AssessEvidenceStrengthLevel;
    score: number;
    sources: string[];
    gaps: string[];
  };
  trustMemory: ProveTrustMemorySummary;
  reviewerGuidance: string;
  receiptCommand: string;
  riskDelta: RiskDeltaSnapshot;
  verifiedWorkflow: ProveVerifiedWorkflow;
}

export interface ProveReceiptScope {
  status: ProveScopeStatus;
  changedFiles: string[];
  allowedTouched: string[];
  forbiddenTouched: string[];
  outsideAllowed: string[];
  classifications: ProveChangedFileClassification[];
  allowedProduction: string[];
  expectedTests: string[];
  unexpectedProduction: string[];
  unexpectedTests: string[];
  documentationTouched: string[];
  configTouched: string[];
  securitySensitiveTouched: string[];
  generatedTouched: string[];
  contractPath?: string;
}

export interface ProveReceiptProofStatus {
  status: ProveProofStatus;
  commandsRequired: string[];
  commandsRun: string[];
  missingCommands: string[];
  failedCommands: string[];
  staleCommands: string[];
  commandEvidence: ProveProofCommandEvidence[];
}

export interface ProveProofCommandEvidence {
  command: string;
  status: ProveProofCommandStatus;
  fresh: boolean;
  exitCode?: number;
  durationMs?: number;
  completedAt?: string;
  outputSummary?: string;
  logPath?: string;
  staleReason?: string;
}

export interface ProveReceipt {
  summary: string;
  commitReadiness: ProveVerdict;
  scope: ProveReceiptScope;
  proofStatus: ProveReceiptProofStatus;
  riskDelta: RiskDeltaSnapshot;
  riskDeltaDirection: ProveRiskDeltaDirection;
  reviewerDecision: ProveReviewerDecision;
  newRisks: string[];
  evidenceGaps: string[];
  reviewerGuidance: string;
  verifiedWorkflow: ProveVerifiedWorkflow;
}

export interface ProveReport {
  schemaVersion: 1;
  mode: ProveMode;
  verdict: ProveVerdict;
  summary: string;
  contract?: ProveContract;
  receipt?: ProveReceipt;
  commands: string[];
  warnings: string[];
  verifiedWorkflow: ProveVerifiedWorkflow;
  savedContractPath?: string;
  ledgerRecord?: ProofLedgerRecord;
}
