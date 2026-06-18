import { expect, test } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import '../../src/types/start.js';
import '../../src/types/qualityScorecard.js';
import type {
  MissionOutcome,
  MissionProofBaselineRun,
  MissionProofReport,
  MissionProofStatusRow,
  MissionProofTotals,
  MissionRunStatus,
  StartExecutionCursor,
  StartExecutionPhase,
  StartExecutionPhaseId,
  StartExecutionPlan,
  StartExecutionStatus,
  StartExecutionStep,
  StartExecutionStepKind,
  StartFirstTenMinutes,
  StartMissionControl,
  StartMissionControlStatus,
  StartMissionHandoff,
  StartMissionProofItem,
  StartMissionReviewGate,
  StartMissionReviewPolicy,
  StartMissionRunbook,
  StartMissionTaskCard,
  StartMissionToolCall,
  StartModeSource,
  StartReport,
  StartRisk,
  StartWorkflowRecommendation,
} from '../../src/types/start.js';
import type {
  QualityScorecardDimension,
  QualityScorecardReport,
  QualityScorecardRisk,
  QualityScorecardStatus,
  QualityScorecardVerdict,
} from '../../src/types/qualityScorecard.js';
import type {
  MissionOutcome as BarrelMissionOutcome,
  MissionProofReport as BarrelMissionProofReport,
  StartReport as BarrelStartReport,
} from '../../src/types.js';
import type {
  QualityScorecardReport as EntryQualityScorecardReport,
  StartReport as EntryStartReport,
} from '../../src/index.js';

const action = {
  label: 'Run preflight',
  command: 'projscan preflight --mode before_edit --format json',
  tool: 'projscan_preflight',
  args: { mode: 'before_edit' },
};

const modeSource: StartModeSource = 'intent';
const controlStatus: StartMissionControlStatus = 'ready';
const phaseId: StartExecutionPhaseId = 'ready_now';
const stepKind: StartExecutionStepKind = 'tool';
const stepStatus: StartExecutionStatus = 'ready';
const missionStatus: MissionRunStatus = 'passed';
const qualityStatus: QualityScorecardStatus = 'watch';
const qualityVerdict: QualityScorecardVerdict = 'needs_attention';

const toolCall: StartMissionToolCall = {
  tool: 'projscan_preflight',
  args: { mode: 'before_edit' },
};

const proofItem: StartMissionProofItem = {
  stepId: 'proof-1',
  status: stepStatus,
  label: 'Preflight',
  command: action.command,
  toolCall,
};

const executionStep: StartExecutionStep = {
  id: 'ready-1',
  kind: stepKind,
  status: stepStatus,
  label: 'Run preflight',
  command: action.command,
};

const cursor: StartExecutionCursor = {
  phaseId,
  stepId: executionStep.id,
  status: stepStatus,
  kind: stepKind,
  label: executionStep.label,
  command: executionStep.command,
  reason: 'Ready to prove the next edit is safe.',
};

const phase: StartExecutionPhase = {
  id: phaseId,
  title: 'Ready now',
  status: stepStatus,
  steps: [executionStep],
};

const executionPlan: StartExecutionPlan = {
  summary: 'Run the ready action, then proof commands.',
  currentPhase: phaseId,
  cursor,
  phases: [phase],
};

const resume = {
  currentStep: cursor,
  status: stepStatus,
  instruction: 'Run preflight.',
  prompt: 'Resume at ready-1.',
  remainingProofItems: [proofItem],
  remainingProofCommands: [action.command],
};

const reviewPolicy: StartMissionReviewPolicy = {
  approvalRequired: true,
  blockedActions: ['push', 'merge'],
  summary: 'Reviewer approval required before integration.',
};

const reviewGate: StartMissionReviewGate = {
  title: 'Mission Review Gate',
  required: true,
  status: controlStatus,
  stopCondition: 'Stop after proof.',
  reviewPrompt: 'Review proof before continuing.',
  checklist: ['Run proof'],
  doneWhen: ['Proof is attached'],
  policy: reviewPolicy,
  decisions: [
    {
      id: 'approve_next_slice',
      label: 'Approve next slice',
      description: 'Allow one more bounded task.',
      consequence: 'No release action is allowed.',
      reply: 'Approved: start one more bounded implementation slice.',
    },
  ],
  commands: [action.command],
  worktree: {
    available: true,
    clean: true,
    changedFileCount: 0,
    files: [],
    baseRef: null,
    summary: 'Clean worktree.',
  },
  proof: {
    summary: 'Ready proof commands.',
    commands: [action.command],
    items: [proofItem],
  },
  markdown: '# Mission Review Gate',
};

const handoff: StartMissionHandoff = {
  currentStep: cursor,
  resume,
  reviewGate,
  nextAction: action,
  readyActions: [action],
  needsInput: [],
  doneWhen: ['Proof is attached'],
  readyProof: {
    summary: 'Ready proof commands.',
    commands: [action.command],
    items: [proofItem],
  },
};

const runbook: StartMissionRunbook = {
  title: 'Mission Runbook',
  status: controlStatus,
  currentPhase: phaseId,
  currentStep: cursor,
  resume,
  readyCommandBlock: action.command,
  markdown: '# Mission Runbook',
};

const outcome: MissionOutcome = {
  schemaVersion: 1,
  available: true,
  missionDir: '.agentloop/missions/example',
  status: missionStatus,
  proof: {
    completedCommands: 1,
    failedCommands: 0,
    reruns: 0,
    totalCommands: 1,
    rows: [
      {
        id: 'proof-1',
        label: 'Preflight',
        command: action.command,
        exitCode: 0,
      } satisfies MissionProofStatusRow,
    ],
  },
  review: {
    decisions: [],
    approvals: 0,
    changeRequests: 0,
    versionCandidateReviews: 0,
  },
  whatChanged: ['Types moved to focused modules.'],
  whatRemains: [],
  versionCandidate: {
    recommendation: 'wait',
    summary: 'No release candidate requested.',
  },
  resumePrompt: 'Resume with the next AgentLoop task.',
};

const taskCard: StartMissionTaskCard = {
  title: 'Mission Task Card',
  status: controlStatus,
  currentPhase: phaseId,
  currentStep: cursor,
  markdown: '# Mission Task Card',
};

const missionControl: StartMissionControl = {
  intent: 'improve next',
  status: controlStatus,
  headline: 'Ready',
  whyNow: 'The next action is already selected.',
  primaryAction: action,
  actionPlan: [action],
  readyActions: [action],
  unresolvedInputs: [],
  guardrails: [action],
  successCriteria: ['The next task has runnable proof.'],
  proofSummary: 'Ready proof commands.',
  proofCommands: [action.command],
  resume,
  handoff,
  executionPlan,
  runbook,
  reviewGate,
  taskCard,
  outcome,
  handoffPrompt: 'Resume with the next ready action.',
};

const recommendedWorkflow: StartWorkflowRecommendation = {
  id: 'before_edit',
  name: 'Before Edit',
  why: 'Gate the first edit.',
  commands: [action.command],
  mcpTools: ['projscan_preflight'],
};

const firstTenMinutes: StartFirstTenMinutes = {
  title: 'First 10 minutes',
  outcome: 'The first edit is gated.',
  commands: [
    {
      id: 'preflight',
      label: 'Gate the edit',
      why: 'Prevents unreviewed agent work.',
      command: action.command,
    },
  ],
};

const startRisk: StartRisk = {
  id: 'risk-hotspot',
  priority: 'p0',
  title: 'Hotspot src/types.ts',
  source: 'hotspot',
  files: ['src/types.ts'],
  command: 'projscan file src/types.ts --format json',
};

const qualityDimension: QualityScorecardDimension = {
  id: 'maintainability',
  label: 'Maintainability',
  status: qualityStatus,
  score: 70,
  summary: 'One hotspot remains.',
  evidence: ['src/types.ts: risk 390'],
  commands: ['projscan quality-scorecard --format json'],
};

const qualityRisk: QualityScorecardRisk = {
  id: 'qs-hotspot-src-types-ts',
  priority: 'p0',
  title: 'Hotspot src/types.ts',
  files: ['src/types.ts'],
  source: 'hotspot',
  command: 'projscan file src/types.ts --format json',
};

const qualityReport: QualityScorecardReport = {
  schemaVersion: 1,
  verdict: qualityVerdict,
  summary: 'needs_attention: maintainability watch',
  health: {
    score: 100,
    grade: 'A',
    errors: 0,
    warnings: 0,
    infos: 0,
  },
  dimensions: [qualityDimension],
  topRisks: [qualityRisk],
  commands: ['projscan quality-scorecard --format json'],
  suggestedNextActions: [action],
};

const missionProofTotals: MissionProofTotals = {
  missions: 1,
  passed: 1,
  failed: 0,
  running: 0,
  notRun: 0,
  unavailable: 0,
  proofCompletionRate: 1,
  reruns: 0,
  failedGates: 0,
  reviewerApprovals: 0,
};

const baselineRun: MissionProofBaselineRun = {
  id: 'baseline-1',
  status: missionStatus,
  reviewerApprovals: 0,
};

const missionProofReport: MissionProofReport = {
  schemaVersion: 1,
  readOnly: true,
  rootPath: '/repo',
  summary: '1 mission passed',
  missionControl: {
    missions: [outcome],
    totals: missionProofTotals,
  },
  baseline: {
    path: '.agentloop/baseline.json',
    runs: [baselineRun],
    totals: { ...missionProofTotals, minutesSpent: 10 },
  },
  riskAvoided: ['Skipped unverified release work.'],
  nextActions: [action],
};

const startReport: StartReport = {
  schemaVersion: 1,
  readOnly: true,
  rootPath: '/repo',
  mode: 'before_edit',
  modeSource,
  modeReason: 'Intent selected before-edit.',
  summary: 'start: before_edit recommends proof first',
  setup: {
    overall: 'pass',
    diagnostics: [
      {
        id: 'node',
        label: 'Node.js',
        status: 'pass',
        summary: 'Node is available.',
      },
    ],
  },
  recommendedWorkflow,
  firstTenMinutes,
  missionControl,
  coordinationHints: [
    {
      id: 'agentloop-task-contract',
      label: 'Start with AgentLoop',
      message: 'Inspect the active task contract before editing.',
      command: 'npm exec agentloop -- status',
    },
  ],
  evidence: {
    workplanVerdict: 'proceed',
    workplanSummary: 'Ready to proceed.',
    qualityVerdict,
    qualitySummary: qualityReport.summary,
    healthScore: 100,
    mcpReady: true,
    riskSources: {
      currentWorktree: {
        kind: 'current-worktree',
        available: true,
        count: 0,
        files: [],
        baseRef: null,
      },
      sessionMemory: {
        kind: 'remembered-session',
        touchedFiles: [],
        totalTouchedFiles: 0,
        note: 'No remembered session risk.',
      },
    },
  },
  topRisks: [startRisk],
  adoptionGaps: [],
  nextActions: [action],
};

const barrelStartReport: BarrelStartReport = startReport;
const barrelMissionOutcome: BarrelMissionOutcome = outcome;
const barrelMissionProofReport: BarrelMissionProofReport = missionProofReport;
const entryStartReport: EntryStartReport = barrelStartReport;
const entryQualityReport: EntryQualityScorecardReport = qualityReport;

test('start and quality public types compile from focused modules and compatibility barrels', () => {
  expect(entryStartReport.missionControl.status).toBe('ready');
  expect(barrelMissionOutcome.status).toBe('passed');
  expect(barrelMissionProofReport.missionControl.totals.passed).toBe(1);
  expect(entryQualityReport.verdict).toBe('needs_attention');
});

test('start public type compatibility module delegates to focused type modules', async () => {
  const source = await fs.readFile(path.join(process.cwd(), 'src/types/start.ts'), 'utf-8');

  expect(source).toContain("export type * from './startExecution.js'");
  expect(source).toContain("export type * from './startMissionControl.js'");
  expect(source).toContain("export type * from './startMissionProof.js'");
  expect(source).toContain("export type * from './startMissionReview.js'");
  expect(source).not.toContain('export interface StartReport');
  expect(source).not.toContain('export interface MissionOutcome');
  expect(source.split('\n').length).toBeLessThan(80);
});
