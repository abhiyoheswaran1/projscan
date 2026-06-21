import type { PreflightVerdict } from './preflight.js';
import type { QualityScorecardVerdict } from './qualityScorecard.js';
import type { WorkplanPriority } from './workplan.js';

export type AssessMode = 'standard' | 'fix-first' | 'ship-readiness';
export type AssessVerdict = 'ready' | 'watch' | 'blocked';
export type AssessConfidence = 'high' | 'medium' | 'low';
export type AssessProofSource =
  | 'issue'
  | 'hotspot'
  | 'coordination'
  | 'doctor'
  | 'preflight'
  | 'session'
  | 'verification';

export interface RiskDeltaSnapshot {
  baselineScore: number;
  projectedScore: number;
  delta: number;
  basis: string[];
}

export interface AssessBaselineComparison {
  previousScore: number;
  currentScore: number;
  delta: number;
  baselinePath?: string;
  summary: string;
}

export interface AssessEvidence {
  source: string;
  detail: string;
  file?: string;
  command?: string;
}

export interface AssessImpact {
  commands: string[];
  affectedAreas: string[];
  likelyFiles: string[];
}

export interface AssessRecommendedFix {
  summary: string;
  safeChangeShape: string;
}

export interface AssessVerification {
  commands: string[];
  expected: string;
}

export interface AssessSuppression {
  command: string;
  inlineHint?: string;
  configHint?: string;
}

export interface AssessFeedback {
  command: string;
}

export interface AssessProofCard {
  id: string;
  priority: WorkplanPriority;
  source: AssessProofSource;
  finding: string;
  whyItMatters: string;
  files: string[];
  evidence: AssessEvidence[];
  impact: AssessImpact;
  recommendedFix: AssessRecommendedFix;
  verification: AssessVerification;
  confidence: AssessConfidence;
  suppression: AssessSuppression;
  feedback: AssessFeedback;
  riskDelta: RiskDeltaSnapshot;
}

export interface AssessAnswers {
  actuallyRisky: string;
  whyRisky: string;
  fixFirst: string;
  safestChange: string;
  testsThatProveIt: string[];
  riskRemoved: string;
  shipNow: string;
}

export interface AssessReport {
  schemaVersion: 1;
  goal: string;
  mode: AssessMode;
  verdict: AssessVerdict;
  summary: string;
  answers: AssessAnswers;
  proofCards: AssessProofCard[];
  fixFirst?: AssessProofCard;
  riskDelta: RiskDeltaSnapshot;
  baselineComparison?: AssessBaselineComparison;
  commands: string[];
  feedback: string[];
  sourceVerdicts?: {
    quality: QualityScorecardVerdict;
    preflight: PreflightVerdict;
  };
  truncated?: boolean;
}
