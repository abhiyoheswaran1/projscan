import { buildMissionExecutionPlan } from './startExecutionPlan.js';
import {
  actionFromWorkflow,
  headlineForStatus,
  missionActionPlan,
  missionGuardrails,
  missionProofCommands,
  missionReadyActions,
  missionStatus,
  missionUnresolvedInputs,
  routedWhyNow,
} from './startMissionPolicy.js';
import {
  buildMissionReviewGate,
  buildMissionReviewProof,
  READY_PROOF_SUMMARY,
} from './startReviewGate.js';
import { buildMissionRunbook, buildMissionTaskCard } from './startRunbook.js';
import { hasProhibitedWorkflowModeAction, routesForIntent } from './startMode.js';
import { missionResume } from './startResume.js';
import { buildMissionSuccessCriteria } from './startSuccessCriteria.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { SessionCoordinationHint } from '../types/session.js';
import type {
  MissionOutcome,
  StartAdoptionGap,
  StartExecutionCursor,
  StartMissionControl,
  StartMissionResume,
  StartMissionReviewGate,
  StartReport,
  StartUnresolvedInput,
  StartWorkflowRecommendation,
} from '../types/start.js';
import type { WorkplanMode, WorkplanReport } from '../types/workplan.js';

export interface BuildMissionControlInput {
  mode: WorkplanMode;
  intent?: string;
  setupOverall: StartReport['setup']['overall'];
  workplan: WorkplanReport;
  workflow: StartWorkflowRecommendation;
  fixFirst?: StartReport['fixFirst'];
  adoptionGaps: StartAdoptionGap[];
  coordinationHints: SessionCoordinationHint[];
  riskSources: StartReport['evidence']['riskSources'];
  missionOutcome?: MissionOutcome;
}

export function buildMissionControl(input: BuildMissionControlInput): StartMissionControl {
  const routeCandidates = routesForIntent(input.intent);
  const routed = routeCandidates[0];
  const alternatives = routeCandidates.slice(1, 4);
  const status = missionStatus(input.setupOverall, input.workplan.verdict, input.adoptionGaps);
  const actionPlan = missionActionPlan(
    input.mode,
    input.intent,
    routed,
    input.fixFirst,
    input.workplan,
    input.workflow,
  );
  const primaryAction = actionPlan[0] ?? actionFromWorkflow(input.workflow);
  const readyActions = missionReadyActions(actionPlan);
  const guardrails = missionGuardrails(input.mode, input.coordinationHints, primaryAction);
  const proofCommands = missionProofCommands(input.mode, input.workplan, guardrails, actionPlan);
  const successCriteria = buildMissionSuccessCriteria({
    mode: input.mode,
    route: routed,
    actionPlan,
    workplan: input.workplan,
  });
  const unresolvedInputs = missionUnresolvedInputs(actionPlan);
  const executionPlan = buildMissionExecutionPlan({
    primaryAction,
    actionPlan,
    readyActions,
    unresolvedInputs,
    successCriteria,
    proofCommands,
  });
  const resume = missionResume(executionPlan, input.missionOutcome);
  const reviewProof = buildMissionReviewProof(resume, proofCommands);
  const whyNow = routed
    ? routedWhyNow(routed, actionPlan)
    : input.fixFirst
      ? `Top evidence points to "${input.fixFirst.title}" as the first useful move.`
      : `The ${input.mode} workflow is the shortest path from orientation to verified action.`;
  const reviewGate = buildMissionReviewGate({
    status,
    doneWhen: successCriteria,
    proof: reviewProof,
    currentWorktree: input.riskSources.currentWorktree,
    autonomousContinuation: isAutonomousContinuationIntent(input.intent),
  });
  const handoffPrompt = missionHandoffPrompt(
    resume,
    successCriteria,
    whyNow,
    unresolvedInputs,
    proofCommands,
    reviewGate,
  );
  const runbook = buildMissionRunbook({
    intent: input.intent,
    status,
    primaryAction,
    readyActions,
    unresolvedInputs,
    successCriteria,
    proofCommands,
    executionPlan,
    resume,
    handoffPrompt,
    reviewGate,
  });
  const taskCard = buildMissionTaskCard({
    intent: input.intent,
    status,
    currentStep: executionPlan.cursor,
    resume,
    successCriteria,
    handoffPrompt,
    reviewGate,
  });
  return {
    ...(input.intent ? { intent: input.intent } : {}),
    status,
    headline: headlineForStatus(status, primaryAction.label),
    whyNow,
    primaryAction,
    actionPlan,
    readyActions,
    ...(routed ? { routedIntent: routed } : {}),
    ...(alternatives.length > 0 ? { alternatives } : {}),
    unresolvedInputs,
    guardrails,
    successCriteria,
    proofSummary: READY_PROOF_SUMMARY,
    proofCommands,
    resume,
    handoff: missionHandoff(
      executionPlan.cursor,
      resume,
      primaryAction,
      readyActions,
      unresolvedInputs,
      successCriteria,
      proofCommands,
      reviewGate,
    ),
    executionPlan,
    runbook,
    reviewGate,
    taskCard,
    ...(input.missionOutcome ? { outcome: input.missionOutcome } : {}),
    handoffPrompt,
  };
}

function isAutonomousContinuationIntent(intent: string | undefined): boolean {
  if (!intent) return false;
  if (/\bautonom(?:ous|ously|osly|y)?\b/i.test(intent)) return true;
  if (/\b(?:go|continue|keep going)\b.*\buntil\s+i\s+tell\s+you\b/i.test(intent)) {
    return true;
  }
  return hasContinuationVerb(intent) && hasProhibitedWorkflowModeAction(intent);
}

function hasContinuationVerb(intent: string): boolean {
  return /\b(?:keep\s+going|continue|continuing|go\s+on)\b/i.test(intent);
}

function missionHandoff(
  currentStep: StartExecutionCursor,
  resume: StartMissionResume,
  nextAction: PreflightSuggestedAction,
  readyActions: PreflightSuggestedAction[],
  needsInput: StartUnresolvedInput[],
  doneWhen: string[],
  proofCommands: string[],
  reviewGate: StartMissionReviewGate,
): StartMissionControl['handoff'] {
  const readyProofCommands = resume.remainingProofCommands ?? proofCommands;
  const readyProofToolCalls = resume.remainingProofToolCalls;
  const readyProofItems = resume.remainingProofItems;
  return {
    currentStep,
    resume,
    reviewGate,
    nextAction,
    readyActions,
    needsInput,
    doneWhen,
    readyProof: {
      summary: READY_PROOF_SUMMARY,
      commands: readyProofCommands,
      ...(readyProofToolCalls && readyProofToolCalls.length > 0
        ? { toolCalls: readyProofToolCalls }
        : {}),
      ...(readyProofItems && readyProofItems.length > 0 ? { items: readyProofItems } : {}),
    },
  };
}

function missionHandoffPrompt(
  resume: StartMissionResume,
  successCriteria: string[],
  whyNow: string,
  unresolvedInputs: StartUnresolvedInput[],
  proofCommands: string[],
  reviewGate: StartMissionReviewGate,
): string {
  const needsInput =
    unresolvedInputs.length > 0
      ? ` Needs input: ${unresolvedInputs.map((input) => `${input.name}=${input.placeholder}`).join(', ')}.`
      : '';
  const proofCommandText = (resume.remainingProofCommands ?? proofCommands)
    .slice(0, 3)
    .join(' && ');
  const readyProof =
    proofCommandText.length > 0
      ? ` Ready proof: ${READY_PROOF_SUMMARY} ${proofCommandText}.`
      : ` Ready proof: ${READY_PROOF_SUMMARY}.`;
  return `Resume: ${trimTrailingPunctuation(resume.prompt)}. Done when: ${trimTrailingPunctuation(successCriteria[0] ?? 'The proof commands pass')}.${needsInput} Why: ${whyNow}${readyProof}${handoffReviewGatePrompt(reviewGate)}`;
}

function handoffReviewGatePrompt(reviewGate: StartMissionReviewGate): string {
  const decisions = reviewGate.decisions
    .map((decision) => `${decision.label} => ${decision.reply}`)
    .join('; ');
  return ` Review gate: ${trimTrailingPunctuation(reviewGate.stopCondition)}. Reviewer replies: ${decisions}`;
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[.!?]+$/g, '');
}
