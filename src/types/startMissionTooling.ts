import type { StartExecutionStatus } from './startExecution.js';

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
