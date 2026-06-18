import type { PreflightSuggestedAction, PreflightVerdict } from './preflight.js';
import type { QualityScorecardVerdict } from './qualityScorecard.js';
import type { SessionCoordinationHint } from './session.js';
import type {
  StartAdoptionGap,
  StartAdoptionLoop,
  StartDailyWorkflow,
  StartFirstTenMinutes,
  StartModeSource,
  StartMissionControlStatus,
  StartRisk,
  StartRoadmapPreview,
  StartRoutedIntent,
  StartUnresolvedInput,
  StartWorkflowRecommendation,
} from './startCommon.js';
import type { StartExecutionPlan } from './startExecution.js';
import type { MissionOutcome } from './startMissionProof.js';
import type {
  StartMissionHandoff,
  StartMissionResume,
  StartMissionRunbook,
  StartMissionTaskCard,
} from './startMissionResume.js';
import type { StartMissionReviewGate } from './startMissionReview.js';
import type { FixFirstRecommendation, WorkplanMode } from './workplan.js';
import type { WorkplanHandoffPayload } from './workplanHandoff.js';

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
  dailyWorkflows?: StartDailyWorkflow[];
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
    roadmapPreview?: StartRoadmapPreview;
  };
  topRisks: StartRisk[];
  fixFirst?: FixFirstRecommendation;
  adoptionGaps: StartAdoptionGap[];
  adoptionLoop?: StartAdoptionLoop;
  nextActions: PreflightSuggestedAction[];
  handoff?: WorkplanHandoffPayload;
  truncated?: boolean;
}
