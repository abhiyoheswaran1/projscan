import type { HealthScore } from './analysis.js';
import type { PreflightVerdict } from './preflight.js';
import type {
  FixFirstRecommendation,
  WorkplanEvidence,
  WorkplanPriority,
  WorkplanVerification,
} from './workplan.js';

export type BugHuntVerdict = 'clean' | 'review' | 'fix' | 'block';

export interface BugHuntFinding {
  id: string;
  priority: WorkplanPriority;
  source: 'doctor' | 'preflight' | 'session' | 'hotspot' | 'verification';
  title: string;
  why: string;
  files: string[];
  evidence: WorkplanEvidence[];
  suggestedTools: string[];
  verification: WorkplanVerification;
}

export interface BugHuntReport {
  schemaVersion: 1;
  verdict: BugHuntVerdict;
  summary: string;
  health: HealthScore;
  evidence: {
    issueCounts: {
      errors: number;
      warnings: number;
      infos: number;
    };
    hotspotCount: number;
    preflightVerdict: PreflightVerdict;
    preflightActionableReasonCount?: number;
    preflightIgnoredReasonCount?: number;
    touchedFiles: string[];
    conflicts: number;
  };
  topSuspects: BugHuntFinding[];
  fixQueue: BugHuntFinding[];
  reviewQueue?: BugHuntFinding[];
  fixFirst?: FixFirstRecommendation;
  verificationMatrix: Array<{ command: string; reason: string; expected: string }>;
  truncated?: boolean;
}
