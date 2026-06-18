import type { PreflightSuggestedAction } from './preflight.js';

export type MissionRunStatus = 'not_run' | 'running' | 'passed' | 'failed' | 'unknown';

export interface MissionProofStatusRow {
  id: string;
  label?: string;
  log?: string;
  command?: string;
  exitCode?: number;
}

export interface MissionReviewDecisionRecord {
  decision: 'approve_next_slice' | 'request_changes' | 'review_version_candidate' | string;
  reviewer?: string;
  at?: string;
  note?: string;
}

export interface MissionOutcome {
  schemaVersion: 1;
  available: boolean;
  missionDir: string;
  status: MissionRunStatus;
  reason?: string;
  nextAction?: string;
  proof: {
    completedCommands: number;
    failedCommands: number;
    reruns: number;
    totalCommands?: number;
    failedStep?: string;
    failedLog?: string;
    exitCode?: number;
    rows: MissionProofStatusRow[];
  };
  review: {
    decisions: MissionReviewDecisionRecord[];
    approvals: number;
    changeRequests: number;
    versionCandidateReviews: number;
  };
  whatChanged: string[];
  whatRemains: string[];
  versionCandidate: {
    recommendation: 'run_proof' | 'wait' | 'review_candidate' | 'do_not_cut';
    summary: string;
  };
  resumePrompt: string;
}

export interface MissionProofBaselineRun {
  id: string;
  status: MissionRunStatus;
  failedGates?: number;
  reruns?: number;
  minutesSpent?: number;
  reviewerApprovals?: number;
}

export interface MissionProofTotals {
  missions: number;
  passed: number;
  failed: number;
  running: number;
  notRun: number;
  unavailable: number;
  proofCompletionRate: number;
  reruns: number;
  failedGates: number;
  reviewerApprovals: number;
}

export interface MissionProofReport {
  schemaVersion: 1;
  readOnly: true;
  rootPath: string;
  summary: string;
  missionControl: {
    missions: MissionOutcome[];
    totals: MissionProofTotals;
  };
  baseline?: {
    path: string;
    runs: MissionProofBaselineRun[];
    totals: MissionProofTotals & { minutesSpent: number };
  };
  comparison?: {
    completionRateDelta: number;
    rerunsAvoided: number;
    failedGatesAvoided: number;
    minutesSaved: number;
  };
  riskAvoided: string[];
  nextActions: PreflightSuggestedAction[];
}
