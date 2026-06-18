import type { WorkplanPriority } from './workplan.js';

export interface StartWorkflowRecommendation {
  id: string;
  name: string;
  why: string;
  commands: string[];
  mcpTools: string[];
}

export interface StartRisk {
  id: string;
  priority: WorkplanPriority;
  title: string;
  source: string;
  files: string[];
  command: string;
}

export interface StartAdoptionGap {
  id: string;
  status: 'info' | 'warn' | 'fail';
  title: string;
  summary: string;
  command?: string;
}

export interface StartAdoptionLoopMetric {
  id: string;
  label: string;
  target: string;
  command?: string;
}

export interface StartAdoptionLoop {
  cadence: 'every_pr';
  why: string;
  metrics: StartAdoptionLoopMetric[];
  nextCommands: string[];
}

export interface StartRoadmapWorkstream {
  id: string;
  title: string;
  priority: WorkplanPriority;
  track: string;
  verificationCommand?: string;
}

export interface StartRoadmapPreview {
  policy: 'product-readiness-plan';
  readOnly: true;
  lines: string[];
  workstreams: StartRoadmapWorkstream[];
}

export interface StartFirstTenMinutesStep {
  id: string;
  label: string;
  why: string;
  command: string;
}

export interface StartFirstTenMinutes {
  title: string;
  outcome: string;
  commands: StartFirstTenMinutesStep[];
}

export type StartDailyWorkflowId =
  | 'before_edit'
  | 'before_handoff'
  | 'release_candidate_review';

export interface StartDailyWorkflow {
  id: StartDailyWorkflowId;
  name: string;
  outcome: string;
  commands: string[];
  successCriteria: string[];
}

export type StartModeSource = 'explicit' | 'intent' | 'default';

export type StartMissionControlStatus = 'ready' | 'needs_setup' | 'needs_attention' | 'blocked';

export interface StartRoutedIntent {
  intent: string;
  category: string;
  tool: string;
  cli: string;
  why: string;
  example: string;
  confidence: 'high' | 'medium' | 'low';
  rank: number;
  score: number;
  matchedKeywords: string[];
}

export interface StartUnresolvedInput {
  name: string;
  placeholder: string;
  sourceAction: string;
  instruction: string;
}
