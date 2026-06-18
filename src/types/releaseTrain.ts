import type { PreflightSuggestedAction, PreflightVerdict } from './preflight.js';
import type { WorkplanPriority, WorkplanVerification } from './workplan.js';

export interface ReleaseTrainTrack {
  line: string;
  theme: string;
  outcome: string;
  includedInPlan: boolean;
  scope: string[];
  successCriteria: string[];
}

export interface ReleaseTrainTask {
  id: string;
  priority: WorkplanPriority;
  title: string;
  why: string;
  track: string;
  files: string[];
  verification: WorkplanVerification;
}

export interface ReleaseTrainReadinessAction {
  kind: 'fix-blockers' | 'manual-signoff' | 'review-cautions' | 'proceed';
  label: string;
  command: string;
  detail: string;
}

export interface ReleaseTrainReport {
  schemaVersion: 1;
  currentVersion: string | null;
  plan: {
    policy: 'product-readiness-plan';
    lines: string[];
    readOnly: true;
  };
  readiness: {
    verdict: PreflightVerdict;
    blockers: number;
    cautions: number;
    summary: string;
    action?: ReleaseTrainReadinessAction;
  };
  tracks: ReleaseTrainTrack[];
  tasks: ReleaseTrainTask[];
  suggestedNextActions: PreflightSuggestedAction[];
}
