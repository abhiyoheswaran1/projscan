import type { IssueSeverity } from './common.js';
import type {
  PreflightMode,
  PreflightReasonSource,
  PreflightSuggestedAction,
  PreflightVerdict,
} from './preflight.js';

export type WorkplanMode = PreflightMode | 'refactor' | 'release' | 'bug_hunt' | 'hardening';

export type WorkplanPriority = 'p0' | 'p1' | 'p2';

export interface WorkplanEvidence {
  source: PreflightReasonSource | 'coordination' | 'release' | 'verification' | 'graph';
  message: string;
  severity?: IssueSeverity;
  file?: string;
  line?: number;
  issueId?: string;
  tool?: string;
}

export interface WorkplanVerification {
  commands: string[];
  expected: string;
}

export interface FixFirstRecommendation {
  id: string;
  title: string;
  source: string;
  priority: WorkplanPriority;
  whyFirst: string;
  files: string[];
  owner?: string;
  commands: string[];
  expected?: string;
}

export interface WorkplanTask {
  id: string;
  priority: WorkplanPriority;
  title: string;
  why: string;
  evidence: WorkplanEvidence[];
  files: string[];
  owner?: string;
  suggestedTools: string[];
  verification: WorkplanVerification;
  handoffText: string;
}

export interface WorkplanTopRisk extends WorkplanEvidence {
  priority: WorkplanPriority;
  owner?: string;
}

// Structural copy of SessionConflict to keep this module independent from the legacy barrel.
interface WorkplanConflict {
  kind: 'same-file' | 'import-related' | 'same-workspace' | 'taint-related' | 'hotspot-overlap';
  files: string[];
  message: string;
  severity: 'warning' | 'error';
}

export interface WorkplanCoordination {
  touchedFiles: string[];
  conflicts: WorkplanConflict[];
  recommendedNextAgent: string;
}

export interface WorkplanReport {
  schemaVersion: 1;
  mode: WorkplanMode;
  verdict: PreflightVerdict;
  summary: string;
  topRisks: WorkplanTopRisk[];
  tasks: WorkplanTask[];
  fixFirst?: FixFirstRecommendation;
  coordination: WorkplanCoordination;
  suggestedNextActions: PreflightSuggestedAction[];
  truncated?: boolean;
}
