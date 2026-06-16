import type { BugHuntVerdict } from './bugHunt.js';
import type { PreflightSuggestedAction, PreflightVerdict } from './preflight.js';
import type { WorkplanPriority, WorkplanVerification } from './workplan.js';

export type RegressionPlanLevel = 'smoke' | 'focused' | 'full';
export type RegressionPlanVerdict = 'ready' | 'needs_tests' | 'blocked';

export interface RegressionPlanTarget {
  id: string;
  priority: WorkplanPriority;
  source: 'baseline' | 'bug-hunt' | 'product-line' | 'preflight';
  title: string;
  why: string;
  files: string[];
  verification: WorkplanVerification;
}

export interface RegressionPlanReport {
  schemaVersion: 1;
  level: RegressionPlanLevel;
  verdict: RegressionPlanVerdict;
  summary: string;
  releaseLines: string[];
  evidence: {
    healthScore: number;
    bugHuntVerdict: BugHuntVerdict;
    preflightVerdict: PreflightVerdict;
    changedFiles: number;
    touchedFiles: number;
  };
  targets: RegressionPlanTarget[];
  commands: string[];
  suggestedNextActions: PreflightSuggestedAction[];
  truncated?: boolean;
}
