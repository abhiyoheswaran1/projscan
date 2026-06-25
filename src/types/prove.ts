import type { AssessConfidence, AssessEvidenceStrengthLevel, RiskDeltaSnapshot } from './assess.js';
import type { ProofRecipeConfig } from './config.js';
import type { ProofLedgerRecord } from './proofLedger.js';

export type ProveMode = 'intent' | 'changed' | 'record' | 'run';
export type ProveVerdict = 'ready' | 'needs-review' | 'blocked';
export type ProveScopeStatus = 'within-contract' | 'drifted' | 'missing-contract';
export type ProveProofStatus = 'not-run' | 'missing' | 'partial' | 'passed' | 'failed' | 'stale';
export type ProveRiskDeltaDirection = 'improved' | 'worse' | 'flat';
export type ProveReviewerDecision = 'safe-to-review' | 'needs-focused-review' | 'stop';
export type ProveProofCommandStatus = 'passed' | 'failed' | 'missing' | 'stale';
export type ProveProofReplayStatus = 'verified' | 'needs-proof' | 'stale' | 'failed' | 'drifted';
export type ProveProofReplayEventKind =
  | 'contract'
  | 'change-set'
  | 'proof-command'
  | 'proof-sufficiency'
  | 'receipt';
export type ProveProofReplayEventStatus =
  | 'passed'
  | 'missing'
  | 'missing-contract'
  | 'stale'
  | 'failed'
  | 'drifted'
  | 'strong'
  | 'adequate'
  | 'weak'
  | ProveProofReplayStatus;
export type ProveRiskSurface =
  | 'production'
  | 'test'
  | 'documentation'
  | 'config'
  | 'security'
  | 'public-api'
  | 'cli'
  | 'mcp'
  | 'dependency'
  | 'generated'
  | 'custom'
  | 'unknown';
export type ProveProofSufficiencyStatus =
  | 'strong'
  | 'adequate'
  | 'weak'
  | 'missing'
  | 'stale'
  | 'failed';
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
  proofSufficiencyStatus?: ProveProofSufficiencyStatus;
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
  proofRequirements?: ProveProofRequirement[];
  teamProofRecipes?: ProveMatchedProofRecipe[];
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

export interface ProveProofRequirement {
  id: string;
  surface: ProveRiskSurface;
  files: string[];
  requiredCommands: string[];
  requiredReview: string;
  reason: string;
  source?: 'inferred' | 'recipe';
  recipeId?: string;
  requiredReviewers?: string[];
}

export interface ProveMatchedProofRecipe extends ProofRecipeConfig {
  matchedFiles: string[];
  forbiddenTouched?: string[];
  missingCommands?: string[];
  failedCommands?: string[];
  staleCommands?: string[];
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
  source?: ProofLedgerRecord['source'];
  exitCode?: number;
  durationMs?: number;
  completedAt?: string;
  recordedChangedFiles?: string[];
  recordedChangedFileFingerprint?: string;
  outputSummary?: string;
  logPath?: string;
  staleReason?: string;
}

export interface ProveProofReplay {
  status: ProveProofReplayStatus;
  summary: string;
  events: ProveProofReplayEvent[];
  changedAfterProof: string[];
  replayCommand: string;
  receiptFingerprint: string;
}

export interface ProveProofReplayEvent {
  kind: ProveProofReplayEventKind;
  status: ProveProofReplayEventStatus;
  summary: string;
  command?: string;
  completedAt?: string;
  changedFiles?: string[];
  changedAfterProof?: string[];
  source?: ProofLedgerRecord['source'];
}

export interface ProveReceipt {
  summary: string;
  commitReadiness: ProveVerdict;
  scope: ProveReceiptScope;
  proofStatus: ProveReceiptProofStatus;
  proofSufficiency?: ProveProofSufficiency;
  proofReplay?: ProveProofReplay;
  teamProofRecipes?: ProveMatchedProofRecipe[];
  requiredReviewers?: string[];
  recipeForbiddenTouched?: string[];
  recipeDrift?: string[];
  recipeGaps?: string[];
  riskDelta: RiskDeltaSnapshot;
  riskDeltaDirection: ProveRiskDeltaDirection;
  reviewerDecision: ProveReviewerDecision;
  newRisks: string[];
  evidenceGaps: string[];
  reviewerGuidance: string;
  verifiedWorkflow: ProveVerifiedWorkflow;
}

export interface ProveProofSufficiency {
  status: ProveProofSufficiencyStatus;
  summary: string;
  requirements: ProveProofRequirementResult[];
  gaps: string[];
  weakRequirements: string[];
  missingRequirements: string[];
  staleRequirements: string[];
  failedRequirements: string[];
}

export interface ProveProofRequirementResult {
  id: string;
  surface: ProveRiskSurface;
  status: ProveProofSufficiencyStatus;
  files: string[];
  requiredCommands: string[];
  matchedCommands: string[];
  requiredReview: string;
  reason: string;
  gaps: string[];
  source?: 'inferred' | 'recipe';
  recipeId?: string;
  requiredReviewers?: string[];
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
