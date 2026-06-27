import type {
  ProveProofStatus,
  ProveProofSufficiencyStatus,
  ProveReceipt,
  ProveScopeStatus,
} from './prove.js';

export type GuardStatus = 'clear' | 'attention' | 'drift' | 'blocked';
export type GuardReviewerAction = 'continue' | 'run-proof' | 'rerun-proof' | 'stop-and-recontract';

export interface ComputeGuardOptions {
  contractPath?: string;
  baseRef?: string;
  ledgerPath?: string;
}

export interface GuardReport {
  schemaVersion: 1;
  kind: 'agent-scope-guard';
  status: GuardStatus;
  exitCode: number;
  summary: string;
  reviewerAction: GuardReviewerAction;
  drift: {
    status: ProveScopeStatus;
    files: string[];
    forbiddenTouched: string[];
    outsideAllowed: string[];
    changedAfterProof: string[];
  };
  proof: {
    status: ProveProofStatus;
    sufficiencyStatus?: ProveProofSufficiencyStatus;
    missingCommands: string[];
    failedCommands: string[];
    staleCommands: string[];
  };
  mutatedFiles: string[];
  receipt?: ProveReceipt;
}
