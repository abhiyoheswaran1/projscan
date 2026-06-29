import type { ProofRecipeConfig } from './config.js';
import type {
  AgentChangePassport,
  AgentChangePassportArtifacts,
  AgentChangePassportReviewerAction,
  AgentChangePassportStatus,
} from './passport.js';
import type {
  ProofBrokerGapKind,
  ProofBrokerGapSeverity,
  ProofBrokerReport,
} from './proofBroker.js';

export interface ComputeReviewGateOptions {
  intent?: string;
  contractPath?: string;
  saveContractPath?: string;
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

export interface ReviewGateRecontractGuidance {
  required: boolean;
  reason: string;
  driftFiles: string[];
  command: string;
}

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
  proofBroker: ProofBrokerReport;
}
