import type { Issue } from './common.js';
import type { PreflightSuggestedAction } from './preflight.js';

export interface SessionCoordinationHint {
  id:
    | 'current-worktree-check'
    | 'remembered-session-context'
    | 'resolve-conflicts'
    | 'swarm-coordination'
    | 'agentloop-task-contract'
    | 'agentflight-verification';
  label: string;
  message: string;
  command: string;
}

export interface SessionResourceSummary {
  schemaVersion: 1;
  sessionId: string;
  touchedFiles: string[];
  recentIssues: Issue[];
  highRiskTouchedFiles: Array<{ file: string; riskScore: number }>;
  staleSignals: string[];
  coordinationHints: SessionCoordinationHint[];
  truncated?: boolean;
}

export interface SessionConflict {
  kind: 'same-file' | 'import-related' | 'same-workspace' | 'taint-related' | 'hotspot-overlap';
  files: string[];
  message: string;
  severity: 'warning' | 'error';
}

export interface SessionHandoff {
  schemaVersion: 1;
  summary: SessionResourceSummary;
  remainingRisks: SessionConflict[];
  suggestedNextActions: PreflightSuggestedAction[];
  coordinationHints: SessionCoordinationHint[];
  avoidRepeating: string[];
}

export interface RiskNowResource {
  schemaVersion: 1;
  conflicts: SessionConflict[];
  touchedFiles: string[];
  coordinationHints: SessionCoordinationHint[];
  truncated?: boolean;
}
