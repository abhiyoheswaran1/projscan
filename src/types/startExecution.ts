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
