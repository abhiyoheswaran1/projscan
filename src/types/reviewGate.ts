import type { ProofRecipeConfig } from './config.js';
import type {
  AgentChangePassport,
  AgentChangePassportArtifacts,
  AgentChangePassportReviewerAction,
  AgentChangePassportStatus,
} from './passport.js';
import type {
  BootstrapContractResult,
  ProofBrokerGapKind,
  ProofBrokerGapSeverity,
  ProofBrokerRecontractGuidance,
  ProofBrokerReport,
} from './proofBroker.js';

export interface ComputeReviewGateOptions {
  intent?: string;
  contractPath?: string;
  saveContractPath?: string;
  bootstrapContract?: boolean;
  outputPassportPath?: string;
  outputPath?: string;
  maxFiles?: number;
  feedbackPath?: string;
  baseRef?: string;
  ledgerPath?: string;
  proofRecipes?: ProofRecipeConfig[];
}

export type ReviewGateStatus = AgentChangePassportStatus;
export type ReviewGateDecisionOutcome = ReviewGateStatus;

export interface ReviewGateDecision {
  allowReview: boolean;
  outcome: ReviewGateDecisionOutcome;
  summary: string;
}

export interface ReviewGateProofDebtItem {
  id: string;
  kind: ProofBrokerGapKind;
  severity: ProofBrokerGapSeverity;
  message: string;
  command?: string;
  file?: string;
  requirementId?: string;
  requiredReviewers?: string[];
  nextAction: string;
}

export interface ReviewGateProofDebt {
  total: number;
  blockers: number;
  warnings: number;
  byKind: Record<ProofBrokerGapKind, number>;
  items: ReviewGateProofDebtItem[];
}

export type ReviewGateRecontractGuidance = ProofBrokerRecontractGuidance;

export interface ReviewGatePrComment {
  title: 'Projscan Review Gate';
  markdown: string;
}

export interface ReviewGateArtifacts extends AgentChangePassportArtifacts {
  reviewGatePath?: string;
}

export interface ReviewGateReport {
  schemaVersion: 1;
  kind: 'review-gate';
  generatedAt: string;
  status: ReviewGateStatus;
  intent?: string;
  target: AgentChangePassport['target'];
  decision: ReviewGateDecision;
  reviewer: {
    decision: AgentChangePassport['reviewer']['decision'];
    action: AgentChangePassportReviewerAction;
    summary: string;
  };
  proofDebt: ReviewGateProofDebt;
  recontract: ReviewGateRecontractGuidance;
  requiredReviewers: string[];
  nextCommands: string[];
  warnings?: string[];
  artifacts: ReviewGateArtifacts;
  prComment: ReviewGatePrComment;
  bootstrap?: BootstrapContractResult;
  proofBroker: ProofBrokerReport;
}
