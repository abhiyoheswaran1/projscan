import type { HealthScore } from './analysis.js';
import type { GraphEvidenceSummary } from './graph.js';
import type { PreflightSuggestedAction } from './preflight.js';
import type { WorkplanPriority } from './workplan.js';

export type AgentBriefIntent = 'next_agent' | 'bug_hunt' | 'release' | 'refactor' | 'hardening';

export interface AgentBriefItem {
  id: string;
  priority: WorkplanPriority;
  title: string;
  why: string;
  files: string[];
  commands: string[];
}

export interface AgentBriefGuardrail {
  id: string;
  label: string;
  reason: string;
  command: string;
}

// Structural copy of SessionCoordinationHint to keep this module independent from the legacy barrel.
interface AgentBriefCoordinationHint {
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

export interface AgentBriefReport {
  schemaVersion: 1;
  intent: AgentBriefIntent;
  summary: string;
  health: HealthScore;
  context: {
    totalFiles: number;
    totalDirectories: number;
    topDirectories: Array<{ directory: string; files: number }>;
    touchedFiles: string[];
    conflicts: number;
    graph?: GraphEvidenceSummary;
    coordinationHints: AgentBriefCoordinationHint[];
  };
  focus: AgentBriefItem[];
  guardrails: AgentBriefGuardrail[];
  suggestedNextActions: PreflightSuggestedAction[];
  truncated?: boolean;
}
