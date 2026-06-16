import type { PreflightSuggestedAction } from '../types/preflight.js';
import type {
  StartExecutionPhase,
  StartExecutionPlan,
  StartExecutionStatus,
  StartExecutionStep,
  StartUnresolvedInput,
} from '../types/start.js';
import { isPlaceholder } from './startIntentTargets.js';
import {
  argsAreReady,
  executionCursor,
  isRunnableCommand,
  proofCommandToolCall,
  uniqueStrings,
} from './startResume.js';

export interface BuildMissionExecutionPlanInput {
  primaryAction: PreflightSuggestedAction;
  actionPlan: PreflightSuggestedAction[];
  readyActions: PreflightSuggestedAction[];
  unresolvedInputs: StartUnresolvedInput[];
  successCriteria: string[];
  proofCommands: string[];
}

export function buildMissionExecutionPlan(
  input: BuildMissionExecutionPlanInput,
): StartExecutionPlan {
  const phases: StartExecutionPhase[] = [];
  const readyStepIds = input.readyActions.map((_, index) => `ready-${index + 1}`);
  const inputStepIdsByPlaceholder = new Map(
    input.unresolvedInputs.map((item, index) => [item.placeholder, `input-${index + 1}`]),
  );
  const nextActionStep = actionToExecutionStep('next-action-1', input.primaryAction);
  phases.push({
    id: 'next_action',
    title: 'Next Action',
    status: nextActionStep.status,
    steps: [nextActionStep],
  });

  if (input.readyActions.length > 0) {
    phases.push({
      id: 'ready_now',
      title: 'Ready Commands',
      status: 'ready',
      steps: input.readyActions.map((action, index) => {
        const step = actionToExecutionStep(`ready-${index + 1}`, action);
        const unlockedInputs = Array.from(inputStepIdsByPlaceholder.values());
        if (index === 0 && unlockedInputs.length > 0) step.unlocks = unlockedInputs;
        return step;
      }),
    });
  }

  if (input.unresolvedInputs.length > 0) {
    phases.push({
      id: 'resolve_inputs',
      title: 'Resolve Inputs',
      status: 'blocked',
      steps: input.unresolvedInputs.map((item, index): StartExecutionStep => {
        const id = `input-${index + 1}`;
        const followUps = followUpIdsForPlaceholder(input.actionPlan, item.placeholder);
        return {
          id,
          kind: 'input',
          status: 'blocked',
          label: item.name,
          ...(readyStepIds[0] ? { dependsOn: [readyStepIds[0]] } : {}),
          ...(followUps.length > 0 ? { unlocks: followUps } : {}),
          placeholder: item.placeholder,
          instruction: item.instruction,
        };
      }),
    });
  }

  const pendingActions = input.actionPlan.filter((action) => !isReadyAction(action));
  if (pendingActions.length > 0) {
    phases.push({
      id: 'follow_up',
      title: 'Follow Up',
      status: 'pending',
      steps: pendingActions.map((action, index) => {
        const step = actionToExecutionStep(`follow-up-${index + 1}`, action);
        const blockedBy = placeholdersInAction(action)
          .map((placeholder) => inputStepIdsByPlaceholder.get(placeholder))
          .filter((id): id is string => typeof id === 'string');
        if (blockedBy.length > 0) {
          step.blockedBy = blockedBy;
          step.dependsOn = uniqueStrings([readyStepIds[0] ?? '', ...blockedBy].filter(Boolean));
        }
        return step;
      }),
    });
  }

  if (input.proofCommands.length > 0) {
    phases.push({
      id: 'proof',
      title: 'Proof',
      status: 'ready',
      steps: input.proofCommands.map(
        (command, index): StartExecutionStep => proofStep(command, index),
      ),
    });
  }

  phases.push({
    id: 'done_when',
    title: 'Done When',
    status: 'pending',
    steps: input.successCriteria.map(
      (criterion, index): StartExecutionStep => ({
        id: `criterion-${index + 1}`,
        kind: 'criterion',
        status: 'pending',
        label: criterion,
      }),
    ),
  });

  const cursor = executionCursor(phases);
  return {
    summary: executionPlanSummary(
      input.readyActions.length,
      input.unresolvedInputs.length,
      input.proofCommands.length,
    ),
    currentPhase: cursor.phaseId,
    cursor,
    phases,
  };
}

export function actionToExecutionStep(
  id: string,
  action: PreflightSuggestedAction,
): StartExecutionStep {
  const step: StartExecutionStep = {
    id,
    kind: 'tool',
    status: executionStatusForAction(action),
    label: action.label,
  };
  if (typeof action.command === 'string') step.command = action.command;
  if (typeof action.tool === 'string') step.tool = action.tool;
  if (action.args) step.args = action.args;
  return step;
}

function followUpIdsForPlaceholder(
  actionPlan: PreflightSuggestedAction[],
  placeholder: string,
): string[] {
  return actionPlan
    .filter((action) => !isReadyAction(action))
    .map((action, index) => ({ action, id: `follow-up-${index + 1}` }))
    .filter(({ action }) => placeholdersInAction(action).includes(placeholder))
    .map(({ id }) => id);
}

export function placeholdersInAction(action: PreflightSuggestedAction): string[] {
  const placeholders = new Set<string>();
  if (typeof action.command === 'string') {
    for (const match of action.command.matchAll(/<[^<>]+>/g)) placeholders.add(match[0]);
  }
  collectPlaceholdersFromValue(action.args, placeholders);
  return Array.from(placeholders);
}

function collectPlaceholdersFromValue(value: unknown, placeholders: Set<string>): void {
  if (typeof value === 'string') {
    if (isPlaceholder(value)) placeholders.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPlaceholdersFromValue(item, placeholders);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectPlaceholdersFromValue(item, placeholders);
  }
}

export function executionStatusForAction(action: PreflightSuggestedAction): StartExecutionStatus {
  if (isReadyAction(action)) return 'ready';
  if (
    (typeof action.command === 'string' && !isRunnableCommand(action.command)) ||
    !argsAreReady(action.args)
  ) {
    return 'blocked';
  }
  return 'pending';
}

export function isReadyAction(action: PreflightSuggestedAction): boolean {
  if (typeof action.command === 'string' && !isRunnableCommand(action.command)) return false;
  if (!argsAreReady(action.args)) return false;
  return typeof action.command === 'string' || typeof action.tool === 'string';
}

function proofStep(command: string, index: number): StartExecutionStep {
  const toolCall = proofCommandToolCall(command);
  return {
    id: `proof-${index + 1}`,
    kind: 'proof',
    status: 'ready',
    label: command,
    command,
    ...(toolCall
      ? {
          tool: toolCall.tool,
          ...(typeof toolCall.args !== 'undefined' ? { args: toolCall.args } : {}),
        }
      : {}),
  };
}

export function executionPlanSummary(
  readyCount: number,
  inputCount: number,
  proofCount: number,
): string {
  const pieces = [`Run ${readyCount} ready ${pluralize(readyCount, 'step')}`];
  if (inputCount > 0) pieces.push(`resolve ${inputCount} input(s)`);
  if (proofCount > 0) pieces.push(`then gather ${proofCount} proof command(s)`);
  return `${pieces.join(', ')}.`;
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
