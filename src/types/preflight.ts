import type { IssueSeverity } from './common.js';
import type { HealthScore } from './analysis.js';

// Mirrors ReviewReport['verdict'] without importing back from the public barrel.
type PreflightReviewVerdict = 'ok' | 'review' | 'block';

export type PreflightMode = 'before_edit' | 'before_commit' | 'before_merge';

export type PreflightVerdict = 'proceed' | 'caution' | 'block';

export type PreflightReasonSource =
  | 'doctor'
  | 'review'
  | 'taint'
  | 'session'
  | 'plugin'
  | 'supply-chain'
  | 'memory'
  | 'changed-files'
  | 'hotspots'
  | 'git'
  | 'format'
  | 'release'
  | 'coordination';

export interface PreflightReason {
  severity: IssueSeverity;
  source: PreflightReasonSource;
  message: string;
  file?: string;
  issueId?: string;
  tool?: string;
}

export interface PreflightRequiredCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'unavailable';
  reason?: string;
}

export interface PreflightSuggestedAction {
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export type PreflightCautionAction = 'fix_now' | 'manual_signoff';

export interface PreflightCautionBudgetItem {
  severity: IssueSeverity;
  source: PreflightReasonSource;
  message: string;
  action: PreflightCautionAction;
  file?: string;
  issueId?: string;
  tool?: string;
  command?: string;
}

export interface PreflightCautionBudget {
  primary?: PreflightCautionBudgetItem;
  reviewOnly: PreflightCautionBudgetItem[];
  fixNow: PreflightCautionBudgetItem[];
  manualSignoff: PreflightCautionBudgetItem[];
}

export interface PreflightReleaseScaleEvidence {
  detected: boolean;
  changedFiles: number;
  threshold: number;
  reviewVerdict?: PreflightReviewVerdict;
  reviewSummary?: string;
  concreteBlockers: string[];
  explanation: string;
}

export interface PreflightEvidence {
  health?: {
    score: number;
    grade: HealthScore['grade'];
    errors: number;
    warnings: number;
    infos: number;
  };
  changedFiles?: {
    available: boolean;
    count: number;
    files: string[];
    reason?: string;
  };
  review?: {
    available: boolean;
    verdict?: PreflightReviewVerdict;
    summary?: string;
    reason?: string;
  };
  session?: {
    kind?: 'remembered-session';
    id: string;
    touchedFiles: string[];
    totalTouchedFiles?: number;
    eventCount: number;
    note?: string;
    truncated?: boolean;
  };
  riskSources?: {
    currentWorktree: {
      kind: 'current-worktree';
      available: boolean;
      count: number;
      files: string[];
      baseRef: string | null;
      reason?: string;
    };
    sessionMemory: {
      kind: 'remembered-session';
      id: string;
      touchedFiles: string[];
      totalTouchedFiles: number;
      eventCount: number;
      note: string;
      truncated?: boolean;
    };
  };
  hotspots?: {
    touched: Array<{ file: string; riskScore: number }>;
  };
  plugins?: {
    enabled: boolean;
    errorIssues: number;
    warningIssues: number;
  };
  supplyChain?: {
    errorIssues: number;
    warningIssues: number;
  };
  releaseScale?: PreflightReleaseScaleEvidence;
  coordination?: {
    available: boolean;
    readiness: 'clear' | 'caution' | 'conflicted';
    worktreeCount: number;
    collisions: { high: number; medium: number };
    contendedClaims: number;
    commandPath?: string;
    command?: string;
    localOnly?: true;
    currentWorktree?: {
      path: string;
      branch: string | null;
      changedFileCount: number;
      uncommittedChangedFileCount: number;
      baseRef: string | null;
    } | null;
    validationWorkflow?: Array<{ command: string; purpose: string }>;
    sessionSeparation?: {
      currentEvidence: string;
      rememberedContext: string;
      command: string;
    };
  };
}

export interface PreflightReport {
  schemaVersion: 1;
  mode: PreflightMode;
  verdict: PreflightVerdict;
  summary: string;
  reasons: PreflightReason[];
  cautionBudget?: PreflightCautionBudget;
  evidence: PreflightEvidence;
  requiredChecks: PreflightRequiredCheck[];
  suggestedNextActions: PreflightSuggestedAction[];
  toolCalls: PreflightSuggestedAction[];
  truncated?: boolean;
}
