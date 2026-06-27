import type {
  ProveContract,
  ProveProofReplayStatus,
  ProveProofStatus,
  ProveProofSufficiencyStatus,
  ProveReceipt,
  ProveReviewerDecision,
  ProveScopeStatus,
  ProveVerifiedWorkflow,
  ProveVerdict,
} from './prove.js';
import type { ProofRecipeConfig } from './config.js';

export type AgentChangePassportStatus = 'ready' | 'needs-proof' | 'drifted' | 'blocked';
export type AgentChangePassportReviewerAction =
  | 'review'
  | 'run-proof'
  | 'rerun-proof'
  | 'stop-and-recontract';

export interface ComputePassportOptions {
  intent?: string;
  contractPath?: string;
  saveContractPath?: string;
  outputPath?: string;
  maxFiles?: number;
  feedbackPath?: string;
  baseRef?: string;
  ledgerPath?: string;
  taskId?: string;
  emitBaseframe?: boolean;
  proofRecipes?: ProofRecipeConfig[];
}

export interface AgentChangePassportBoundary {
  contractId?: string;
  allowedFiles: string[];
  forbiddenFiles: string[];
  likelyTests: string[];
  riskyContracts: string[];
  proofCommands: string[];
  receiptCommand?: string;
}

export interface AgentChangePassportReceiptSummary {
  scopeStatus: ProveScopeStatus;
  proofStatus: ProveProofStatus;
  proofSufficiencyStatus?: ProveProofSufficiencyStatus;
  proofReplayStatus?: ProveProofReplayStatus;
  changedFiles: string[];
  forbiddenTouched: string[];
  outsideAllowed: string[];
  changedAfterProof: string[];
  missingCommands: string[];
  failedCommands: string[];
  staleCommands: string[];
  requiredReviewers: string[];
}

export interface AgentChangePassportReviewerSummary {
  decision: ProveReviewerDecision;
  action: AgentChangePassportReviewerAction;
  summary: string;
}

export interface AgentChangePassportArtifacts {
  contractPath?: string;
  passportPath?: string;
}

export interface AgentChangePassportBaseframe {
  taskId: string;
  assessmentPath: string;
  workflowPath: string;
}

export interface AgentChangePassport {
  schemaVersion: 1;
  kind: 'agent-change-passport';
  generatedAt: string;
  status: AgentChangePassportStatus;
  intent?: string;
  summary: string;
  boundary: AgentChangePassportBoundary;
  receipt: AgentChangePassportReceiptSummary;
  reviewer: AgentChangePassportReviewerSummary;
  nextCommands: string[];
  warnings: string[];
  artifacts: AgentChangePassportArtifacts;
  baseframe?: AgentChangePassportBaseframe;
  prove: {
    verdict: ProveVerdict;
    verifiedWorkflow: ProveVerifiedWorkflow;
    contract?: ProveContract;
    receipt?: ProveReceipt;
  };
}
