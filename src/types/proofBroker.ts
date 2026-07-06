import type { ProofRecipeConfig } from './config.js';
import type {
  AgentChangePassport,
  AgentChangePassportReviewerAction,
  AgentChangePassportStatus,
} from './passport.js';
import type {
  ProveProofReplayStatus,
  ProveProofStatus,
  ProveProofSufficiencyStatus,
  ProveRiskSurface,
  ProveScopeStatus,
} from './prove.js';

export interface ComputeProofBrokerOptions {
  intent?: string;
  contractPath?: string;
  saveContractPath?: string;
  outputPassportPath?: string;
  maxFiles?: number;
  feedbackPath?: string;
  baseRef?: string;
  ledgerPath?: string;
  proofRecipes?: ProofRecipeConfig[];
}

export type ProofBrokerGapKind =
  | 'missing-contract'
  | 'scope-drift'
  | 'missing-proof'
  | 'failed-proof'
  | 'stale-proof'
  | 'weak-proof'
  | 'recipe-gap';

export type ProofBrokerGapSeverity = 'info' | 'warning' | 'blocker';

export interface ProofBrokerGap {
  kind: ProofBrokerGapKind;
  severity: ProofBrokerGapSeverity;
  message: string;
  command?: string;
  file?: string;
  requirementId?: string;
}

export interface ProofBrokerRequiredProof {
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

export type ProofBrokerPrPassportSection =
  | 'reviewer'
  | 'scope'
  | 'required-proof'
  | 'gaps'
  | 'reviewers'
  | 'recontract'
  | 'next-commands'
  | 'artifacts';

export interface ProofBrokerPrPassport {
  title: 'Projscan PR Passport';
  markdown: string;
  sections: ProofBrokerPrPassportSection[];
}

export interface ProofBrokerRecontractGuidance {
  required: boolean;
  reason: string;
  target: {
    effectiveWorktreePath: string;
    effectiveWorktreeBranch: string | null;
    effectiveWorktreeHead: string | null;
  };
  driftFiles: string[];
  recommendedIntent: string | null;
  recommendedContractPath: string;
  followUpCommands: string[];
}

export interface ProofBrokerReport {
  schemaVersion: 1;
  kind: 'proof-broker';
  generatedAt: string;
  status: AgentChangePassportStatus;
  summary: string;
  intent?: string;
  target: AgentChangePassport['target'];
  reviewer: {
    decision: AgentChangePassport['reviewer']['decision'];
    action: AgentChangePassportReviewerAction;
    summary: string;
  };
  requiredProof: ProofBrokerRequiredProof[];
  proof: {
    status: ProveProofStatus;
    sufficiencyStatus?: ProveProofSufficiencyStatus;
    replayStatus?: ProveProofReplayStatus;
    missingCommands: string[];
    failedCommands: string[];
    staleCommands: string[];
  };
  scope: {
    status: ProveScopeStatus;
    changedFiles: string[];
    riskyChangedFiles: string[];
    forbiddenTouched: string[];
    outsideAllowed: string[];
    changedAfterProof: string[];
  };
  requiredReviewers: string[];
  gaps: ProofBrokerGap[];
  recontract: ProofBrokerRecontractGuidance;
  nextCommands: string[];
  warnings: string[];
  artifacts: AgentChangePassport['artifacts'];
  prPassport: ProofBrokerPrPassport;
  passport: AgentChangePassport;
}
