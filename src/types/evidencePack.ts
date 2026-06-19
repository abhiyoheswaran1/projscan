import type { BaselineTrend } from './baseline.js';
import type { PreflightSuggestedAction } from './preflight.js';
import type { ReleaseTrainReport } from './releaseTrain.js';
import type { FixFirstRecommendation, WorkplanPriority } from './workplan.js';

export type EvidencePackVerdict = 'ready' | 'caution' | 'blocked';
export type EvidencePackArtifactStatus = 'ready' | 'caution' | 'blocked';

export interface EvidencePackArtifact {
  id: string;
  title: string;
  status: EvidencePackArtifactStatus;
  summary: string;
  evidence: string[];
  commands: string[];
}

export interface EvidencePackTopRisk {
  priority: WorkplanPriority;
  title: string;
  files: string[];
  owner?: string;
  command: string;
}

export interface EvidencePackTeamRoute {
  owner: string;
  files: string[];
  reason: string;
}

export interface EvidencePackTrustCalibration {
  verdict: 'clean' | 'manual_review' | 'actual_defect';
  summary: string;
  concreteBlockers: string[];
  manualReviewSignals: string[];
  watchSignals: string[];
}

export interface EvidencePackPrSummary {
  verdictLabel: string;
  decision: string;
  trust: EvidencePackTrustCalibration;
  topRisks: EvidencePackTopRisk[];
  teamRoutes: EvidencePackTeamRoute[];
  ownershipSuggestion?: string;
  fixFirst?: FixFirstRecommendation;
  nextCommands: string[];
  baselineTrend?: BaselineTrend;
}

export type EvidencePackDailyPrWorkflowStepId =
  | 'context'
  | 'gate'
  | 'fix_first'
  | 'review_packet'
  | 'feedback';

export interface EvidencePackDailyPrWorkflowStep {
  id: EvidencePackDailyPrWorkflowStepId;
  label: string;
  command: string;
  purpose: string;
}

export interface EvidencePackPrCommentValidationCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
}

export interface EvidencePackPrCommentValidation {
  status: 'pass' | 'warn' | 'fail';
  checks: EvidencePackPrCommentValidationCheck[];
}

export interface EvidencePackReport {
  schemaVersion: 1;
  currentVersion: string | null;
  readOnly: true;
  verdict: EvidencePackVerdict;
  summary: string;
  train: {
    lines: string[];
    readiness: ReleaseTrainReport['readiness'];
  };
  approval: {
    required: true;
    recommendation: string;
    blockingReasons: string[];
  };
  artifacts: EvidencePackArtifact[];
  changelogEntries: string[];
  websitePrompt?: string;
  prComment?: string;
  prCommentValidation?: EvidencePackPrCommentValidation;
  prSummary?: EvidencePackPrSummary;
  dailyPrWorkflow?: EvidencePackDailyPrWorkflowStep[];
  suggestedNextActions: PreflightSuggestedAction[];
}
