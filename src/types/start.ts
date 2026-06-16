import type { PreflightSuggestedAction, PreflightVerdict } from './preflight.js';
import type { FixFirstRecommendation, WorkplanMode, WorkplanPriority } from './workplan.js';
import type { WorkplanHandoffPayload } from './workplanHandoff.js';
import type { QualityScorecardVerdict } from './qualityScorecard.js';
import type { SessionCoordinationHint } from './session.js';

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

export interface StartMissionResumeReference {
  id: string;
  phaseId: StartExecutionPhaseId;
  kind: StartExecutionStepKind;
  status: StartExecutionStatus;
  label: string;
  instruction?: string;
  command?: string;
  placeholder?: string;
}

export interface StartMissionToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

export interface StartMissionProofToolCall extends StartMissionToolCall {
  stepId: string;
  command: string;
}

export interface StartMissionProofItem {
  stepId: string;
  status: StartExecutionStatus;
  label: string;
  command: string;
  toolCall?: StartMissionToolCall;
}

export interface StartMissionInputBinding {
  inputId: string;
  label: string;
  placeholder: string;
  instruction: string;
  followUpIds: string[];
}

export type StartMissionResumeChecklistItemKind =
  | 'run_current'
  | 'resolve_input'
  | 'run_follow_up'
  | 'run_proof'
  | 'confirm_done';

export interface StartMissionResumeChecklistItem {
  id: string;
  kind: StartMissionResumeChecklistItemKind;
  phaseId: StartExecutionPhaseId;
  stepId: string;
  status: StartExecutionStatus;
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
  placeholder?: string;
  instruction?: string;
  blockedBy?: string[];
  dependsOn?: string[];
  unlocks?: string[];
  followUpIds?: string[];
}

export interface StartMissionResumeFollowUp {
  id: string;
  phaseId: StartExecutionPhaseId;
  kind: StartExecutionStepKind;
  status: StartExecutionStatus;
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
  blockedBy?: string[];
  dependsOn?: string[];
}

export interface StartMissionResume {
  currentStep: StartExecutionCursor;
  status: StartExecutionStatus;
  instruction: string;
  prompt: string;
  commandBlock?: string;
  toolCall?: StartMissionToolCall;
  followUps?: StartMissionResumeFollowUp[];
  inputBindings?: StartMissionInputBinding[];
  checklist?: StartMissionResumeChecklistItem[];
  remainingProofItems?: StartMissionProofItem[];
  remainingProofCommands?: string[];
  remainingProofToolCalls?: StartMissionProofToolCall[];
  unlocks?: StartMissionResumeReference[];
  blockedBy?: StartMissionResumeReference[];
}

export interface StartMissionHandoff {
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  reviewGate: StartMissionReviewGate;
  nextAction: PreflightSuggestedAction;
  readyActions: PreflightSuggestedAction[];
  needsInput: StartUnresolvedInput[];
  doneWhen: string[];
  readyProof: {
    summary: string;
    commands: string[];
    toolCalls?: StartMissionProofToolCall[];
    items?: StartMissionProofItem[];
  };
}

export type StartExecutionPhaseId =
  | 'next_action'
  | 'ready_now'
  | 'resolve_inputs'
  | 'follow_up'
  | 'proof'
  | 'done_when';

export type StartExecutionStatus = 'ready' | 'blocked' | 'pending';

export type StartExecutionStepKind = 'tool' | 'input' | 'proof' | 'criterion' | 'handoff';

export interface StartExecutionStep {
  id: string;
  kind: StartExecutionStepKind;
  status: StartExecutionStatus;
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
  instruction?: string;
  placeholder?: string;
  dependsOn?: string[];
  blockedBy?: string[];
  unlocks?: string[];
}

export interface StartExecutionPhase {
  id: StartExecutionPhaseId;
  title: string;
  status: StartExecutionStatus;
  steps: StartExecutionStep[];
}

export interface StartExecutionCursor {
  phaseId: StartExecutionPhaseId;
  stepId: string;
  status: StartExecutionStatus;
  kind: StartExecutionStepKind;
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
  instruction?: string;
  placeholder?: string;
  blockedBy?: string[];
  unlocks?: string[];
  reason: string;
}

export interface StartExecutionPlan {
  summary: string;
  currentPhase: StartExecutionPhaseId;
  cursor: StartExecutionCursor;
  phases: StartExecutionPhase[];
}

export interface StartMissionRunbook {
  title: string;
  status: StartMissionControlStatus;
  currentPhase: StartExecutionPhaseId;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  readyCommandBlock: string;
  blockedInputSummary?: string;
  markdown: string;
}

export interface StartMissionReviewWorktree {
  available: boolean;
  clean: boolean;
  changedFileCount: number;
  files: string[];
  baseRef: string | null;
  summary: string;
  reason?: string;
}

export interface StartMissionReviewProof {
  summary: string;
  commands: string[];
  toolCalls?: StartMissionProofToolCall[];
  items?: StartMissionProofItem[];
}

export type StartMissionReviewBlockedAction =
  | 'next_slice'
  | 'release'
  | 'publish'
  | 'deploy'
  | 'push'
  | 'merge'
  | 'version_bump';

export interface StartMissionReviewPolicy {
  approvalRequired: true;
  blockedActions: StartMissionReviewBlockedAction[];
  summary: string;
}

export interface StartMissionReviewDecision {
  id: 'approve_next_slice' | 'request_changes' | 'review_version_candidate';
  label: string;
  description: string;
  consequence: string;
  reply: string;
}

export interface StartMissionReviewGate {
  title: string;
  required: true;
  status: StartMissionControlStatus;
  stopCondition: string;
  reviewPrompt: string;
  checklist: string[];
  doneWhen: string[];
  policy: StartMissionReviewPolicy;
  decisions: StartMissionReviewDecision[];
  commands: string[];
  worktree: StartMissionReviewWorktree;
  proof: StartMissionReviewProof;
  markdown: string;
}

export type MissionRunStatus = 'not_run' | 'running' | 'passed' | 'failed' | 'unknown';

export interface MissionProofStatusRow {
  id: string;
  label?: string;
  log?: string;
  command?: string;
  exitCode?: number;
}

export interface MissionReviewDecisionRecord {
  decision: 'approve_next_slice' | 'request_changes' | 'review_version_candidate' | string;
  reviewer?: string;
  at?: string;
  note?: string;
}

export interface MissionOutcome {
  schemaVersion: 1;
  available: boolean;
  missionDir: string;
  status: MissionRunStatus;
  reason?: string;
  nextAction?: string;
  proof: {
    completedCommands: number;
    failedCommands: number;
    reruns: number;
    totalCommands?: number;
    failedStep?: string;
    failedLog?: string;
    exitCode?: number;
    rows: MissionProofStatusRow[];
  };
  review: {
    decisions: MissionReviewDecisionRecord[];
    approvals: number;
    changeRequests: number;
    versionCandidateReviews: number;
  };
  whatChanged: string[];
  whatRemains: string[];
  versionCandidate: {
    recommendation: 'run_proof' | 'wait' | 'review_candidate' | 'do_not_cut';
    summary: string;
  };
  resumePrompt: string;
}

export interface MissionProofBaselineRun {
  id: string;
  status: MissionRunStatus;
  failedGates?: number;
  reruns?: number;
  minutesSpent?: number;
  reviewerApprovals?: number;
}

export interface MissionProofTotals {
  missions: number;
  passed: number;
  failed: number;
  running: number;
  notRun: number;
  unavailable: number;
  proofCompletionRate: number;
  reruns: number;
  failedGates: number;
  reviewerApprovals: number;
}

export interface MissionProofReport {
  schemaVersion: 1;
  readOnly: true;
  rootPath: string;
  summary: string;
  missionControl: {
    missions: MissionOutcome[];
    totals: MissionProofTotals;
  };
  baseline?: {
    path: string;
    runs: MissionProofBaselineRun[];
    totals: MissionProofTotals & { minutesSpent: number };
  };
  comparison?: {
    completionRateDelta: number;
    rerunsAvoided: number;
    failedGatesAvoided: number;
    minutesSaved: number;
  };
  riskAvoided: string[];
  nextActions: PreflightSuggestedAction[];
}

export interface StartMissionTaskCard {
  title: string;
  status: StartMissionControlStatus;
  currentPhase: StartExecutionPhaseId;
  currentStep: StartExecutionCursor;
  markdown: string;
}

export interface StartMissionControl {
  intent?: string;
  status: StartMissionControlStatus;
  headline: string;
  whyNow: string;
  primaryAction: PreflightSuggestedAction;
  actionPlan: PreflightSuggestedAction[];
  readyActions: PreflightSuggestedAction[];
  routedIntent?: StartRoutedIntent;
  alternatives?: StartRoutedIntent[];
  unresolvedInputs: StartUnresolvedInput[];
  guardrails: PreflightSuggestedAction[];
  successCriteria: string[];
  proofSummary: string;
  proofCommands: string[];
  resume: StartMissionResume;
  handoff: StartMissionHandoff;
  executionPlan: StartExecutionPlan;
  runbook: StartMissionRunbook;
  reviewGate: StartMissionReviewGate;
  taskCard: StartMissionTaskCard;
  outcome?: MissionOutcome;
  handoffPrompt: string;
}

export interface StartReport {
  schemaVersion: 1;
  readOnly: true;
  rootPath: string;
  mode: WorkplanMode;
  modeSource: StartModeSource;
  modeReason: string;
  summary: string;
  setup: {
    overall: 'pass' | 'warn' | 'fail' | 'info';
    diagnostics: Array<{
      id: string;
      label: string;
      status: 'pass' | 'warn' | 'fail' | 'info';
      summary: string;
      detail?: string;
      command?: string;
    }>;
  };
  recommendedWorkflow: StartWorkflowRecommendation;
  firstTenMinutes: StartFirstTenMinutes;
  missionControl: StartMissionControl;
  coordinationHints: SessionCoordinationHint[];
  evidence: {
    workplanVerdict: PreflightVerdict;
    workplanSummary: string;
    qualityVerdict: QualityScorecardVerdict;
    qualitySummary: string;
    healthScore: number;
    mcpReady: boolean;
    riskSources: {
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
        touchedFiles: string[];
        totalTouchedFiles: number;
        note: string;
        truncated?: boolean;
      };
    };
  };
  topRisks: StartRisk[];
  fixFirst?: FixFirstRecommendation;
  adoptionGaps: StartAdoptionGap[];
  adoptionLoop?: StartAdoptionLoop;
  nextActions: PreflightSuggestedAction[];
  handoff?: WorkplanHandoffPayload;
  truncated?: boolean;
}
