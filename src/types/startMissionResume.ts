import type { PreflightSuggestedAction } from './preflight.js';
import type { StartMissionControlStatus, StartUnresolvedInput } from './startCommon.js';
import type {
  StartExecutionCursor,
  StartExecutionPhaseId,
  StartExecutionStatus,
  StartExecutionStepKind,
} from './startExecution.js';
import type { StartMissionReviewGate } from './startMissionReview.js';
import type {
  StartMissionProofItem,
  StartMissionProofToolCall,
  StartMissionToolCall,
} from './startMissionTooling.js';

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

export interface StartMissionTaskCard {
  title: string;
  status: StartMissionControlStatus;
  currentPhase: StartExecutionPhaseId;
  currentStep: StartExecutionCursor;
  markdown: string;
}
