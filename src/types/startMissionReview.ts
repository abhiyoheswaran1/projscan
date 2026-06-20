import type { StartMissionControlStatus } from './startCommon.js';
import type { StartMissionProofItem, StartMissionProofToolCall } from './startMissionTooling.js';

export interface StartMissionReviewWorktree {
  available: boolean;
  clean: boolean;
  changedFileCount: number;
  branchChangedFileCount?: number;
  uncommittedChangedFileCount?: number;
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
