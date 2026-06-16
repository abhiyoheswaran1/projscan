import type {
  MissionOutcome,
  StartExecutionCursor,
  StartExecutionPhase,
  StartExecutionPhaseId,
  StartExecutionPlan,
  StartExecutionStep,
  StartMissionInputBinding,
  StartMissionProofItem,
  StartMissionProofToolCall,
  StartMissionResume,
  StartMissionResumeChecklistItem,
  StartMissionResumeReference,
} from '../types/start.js';
import { isPlaceholder } from './startIntentTargets.js';

type FoundExecutionStep = { phase: StartExecutionPhase; step: StartExecutionStep };

const CURSOR_SELECTORS: Array<(phase: StartExecutionPhase, step: StartExecutionStep) => boolean> = [
  (phase, step) =>
    phase.id === 'ready_now' && step.status === 'ready' && typeof step.command === 'string',
  (phase, step) => phase.id === 'resolve_inputs' && step.status === 'blocked',
  (phase, step) => phase.id === 'proof' && step.status === 'ready',
  (phase) => phase.id === 'done_when',
  (phase) => phase.id === 'next_action',
];

const CURSOR_REASON_RULES: Array<{
  matches: (step: StartExecutionStep) => boolean;
  reason: (step: StartExecutionStep) => string;
}> = [
  { matches: (step) => step.status === 'ready' && step.kind === 'tool', reason: readyToolReason },
  {
    matches: (step) => step.status === 'blocked' && step.kind === 'input',
    reason: () => 'Resolve this blocked input before running dependent follow-up steps.',
  },
  {
    matches: (step) => step.status === 'ready' && step.kind === 'proof',
    reason: () => 'Run this proof command when action steps are complete.',
  },
  {
    matches: (step) => step.kind === 'criterion',
    reason: () => 'Use this criterion to decide when the task is complete.',
  },
];

function readyToolReason(step: StartExecutionStep): string {
  return step.unlocks && step.unlocks.length > 0
    ? 'Run this ready command next; it can unlock later inputs or follow-up steps.'
    : 'Run this ready command next.';
}

export function missionResume(
  plan: StartExecutionPlan,
  outcome?: MissionOutcome,
): StartMissionResume {
  const cursor = plan.cursor;
  const commandBlock = runnableCursorCommand(cursor);
  const toolCall = resumeToolCall(plan, cursor);
  const followUps = resumeFollowUps(plan, cursor);
  const inputBindings = resumeInputBindings(plan, cursor);
  const checklist = resumeChecklist(plan, cursor, inputBindings, followUps);
  const remainingProofItems = resumeRemainingProofItems(checklist);
  const remainingProofCommands = resumeRemainingProofCommands(checklist);
  const remainingProofToolCalls = resumeRemainingProofToolCalls(checklist);
  const unlocks = resolveResumeReferences(plan, cursor.unlocks);
  const blockedBy = resolveResumeReferences(plan, cursor.blockedBy);
  const instruction = resumeInstruction(cursor, commandBlock);
  const prompt = resumePrompt(cursor, commandBlock, instruction, unlocks, blockedBy, outcome);
  const resume: StartMissionResume = {
    currentStep: cursor,
    status: cursor.status,
    instruction,
    prompt,
  };
  attachResumeAction(resume, commandBlock, toolCall);
  attachResumeCollections(resume, {
    followUps,
    inputBindings,
    checklist,
    remainingProofItems,
    remainingProofCommands,
    remainingProofToolCalls,
    unlocks,
    blockedBy,
  });
  return resume;
}

function runnableCursorCommand(cursor: StartExecutionCursor): string | undefined {
  return cursor.command && isRunnableCommand(cursor.command) ? cursor.command : undefined;
}

function resumeInstruction(cursor: StartExecutionCursor, commandBlock: string | undefined): string {
  if (commandBlock) return `Run ${commandBlock}.`;
  if (cursor.instruction) return `Resolve ${cursor.label}: ${cursor.instruction}`;
  return `Continue with ${cursor.label}.`;
}

function resumePrompt(
  cursor: StartExecutionCursor,
  commandBlock: string | undefined,
  instruction: string,
  unlocks: StartMissionResumeReference[],
  blockedBy: StartMissionResumeReference[],
  outcome?: MissionOutcome,
): string {
  const base = commandBlock
    ? `Resume at ${cursor.stepId} in ${cursor.phaseId}: run \`${commandBlock}\`.${resumeUnlocksSentence(unlocks, cursor.unlocks)}`
    : `Resume at ${cursor.stepId} in ${cursor.phaseId}: ${instruction}${resumeBlockersSentence(blockedBy, cursor.blockedBy)}`;
  return outcome?.available ? `${outcome.resumePrompt} ${base}` : base;
}

function attachResumeAction(
  resume: StartMissionResume,
  commandBlock: string | undefined,
  toolCall: StartMissionResume['toolCall'] | undefined,
): void {
  if (commandBlock) resume.commandBlock = commandBlock;
  if (toolCall) resume.toolCall = toolCall;
}

function attachResumeCollections(
  resume: StartMissionResume,
  collections: {
    followUps: NonNullable<StartMissionResume['followUps']>;
    inputBindings: StartMissionInputBinding[];
    checklist: StartMissionResumeChecklistItem[];
    remainingProofItems: StartMissionProofItem[];
    remainingProofCommands: string[];
    remainingProofToolCalls: StartMissionProofToolCall[];
    unlocks: StartMissionResumeReference[];
    blockedBy: StartMissionResumeReference[];
  },
): void {
  if (collections.followUps.length > 0) resume.followUps = collections.followUps;
  if (collections.inputBindings.length > 0) resume.inputBindings = collections.inputBindings;
  if (collections.checklist.length > 0) resume.checklist = collections.checklist;
  if (collections.remainingProofItems.length > 0)
    resume.remainingProofItems = collections.remainingProofItems;
  if (collections.remainingProofCommands.length > 0)
    resume.remainingProofCommands = collections.remainingProofCommands;
  if (collections.remainingProofToolCalls.length > 0)
    resume.remainingProofToolCalls = collections.remainingProofToolCalls;
  if (collections.unlocks.length > 0) resume.unlocks = collections.unlocks;
  if (collections.blockedBy.length > 0) resume.blockedBy = collections.blockedBy;
}

function resumeRemainingProofCommands(checklist: StartMissionResumeChecklistItem[]): string[] {
  return checklist
    .filter((item) => item.kind === 'run_proof' && typeof item.command === 'string')
    .map((item) => item.command as string);
}

function resumeRemainingProofItems(
  checklist: StartMissionResumeChecklistItem[],
): StartMissionProofItem[] {
  return checklist.flatMap((item) => {
    if (item.kind !== 'run_proof' || typeof item.command !== 'string') return [];
    const toolCall = proofChecklistToolCall(item);
    return [
      {
        stepId: item.stepId,
        status: item.status,
        label: item.label,
        command: item.command,
        ...(toolCall ? { toolCall } : {}),
      },
    ];
  });
}

function resumeRemainingProofToolCalls(
  checklist: StartMissionResumeChecklistItem[],
): StartMissionProofToolCall[] {
  return checklist.flatMap((item) => {
    if (item.kind !== 'run_proof' || typeof item.command !== 'string') return [];
    const toolCall = proofChecklistToolCall(item);
    return toolCall ? [{ stepId: item.stepId, command: item.command, ...toolCall }] : [];
  });
}

function proofChecklistToolCall(
  item: StartMissionResumeChecklistItem,
): StartMissionResume['toolCall'] | undefined {
  if (item.tool) {
    return {
      tool: item.tool,
      ...(typeof item.args !== 'undefined' ? { args: item.args } : {}),
    };
  }
  return typeof item.command === 'string' ? proofCommandToolCall(item.command) : undefined;
}

export function proofCommandToolCall(command: string): StartMissionResume['toolCall'] | undefined {
  const preflightMatch = /^projscan preflight(?: --mode ([a-z_]+))? --format json$/.exec(command);
  if (preflightMatch) {
    return {
      tool: 'projscan_preflight',
      args: preflightMatch[1] ? { mode: preflightMatch[1] } : {},
    };
  }

  const understandMatch =
    /^projscan understand --view ([a-z_]+)(?: --intent "((?:\\.|[^"\\])*)")? --format json$/.exec(
      command,
    );
  if (understandMatch) {
    return {
      tool: 'projscan_understand',
      args: {
        view: understandMatch[1],
        ...(understandMatch[2] ? { intent: unescapeDoubleQuoted(understandMatch[2]) } : {}),
      },
    };
  }

  if (command === 'projscan session touched --format json') {
    return {
      tool: 'projscan_session',
      args: { action: 'touched' },
    };
  }

  return undefined;
}

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\(["\\$`])/g, '$1');
}

function resumeChecklist(
  plan: StartExecutionPlan,
  cursor: StartExecutionCursor,
  inputBindings: StartMissionInputBinding[],
  followUps: NonNullable<StartMissionResume['followUps']>,
): StartMissionResumeChecklistItem[] {
  const current = findStepInPlan(plan, cursor.stepId);
  const currentItem = current
    ? resumeChecklistItemFromStep(
        current.phase,
        current.step,
        currentChecklistKind(current.step),
        cursor.stepId,
      )
    : undefined;
  const includedStepIds = new Set(currentItem ? [currentItem.stepId] : []);
  const inputItems = inputBindings.flatMap((binding) => {
    if (includedStepIds.has(binding.inputId)) return [];
    const found = findStepInPlan(plan, binding.inputId);
    if (!found) return [];
    includedStepIds.add(found.step.id);
    return [
      {
        id: `resume-${found.step.id}`,
        kind: 'resolve_input',
        phaseId: found.phase.id,
        stepId: found.step.id,
        status: found.step.status,
        label: binding.label,
        placeholder: binding.placeholder,
        instruction: binding.instruction,
        followUpIds: binding.followUpIds,
        ...(found.step.dependsOn && found.step.dependsOn.length > 0
          ? { dependsOn: found.step.dependsOn }
          : {}),
        ...(found.step.unlocks && found.step.unlocks.length > 0
          ? { unlocks: found.step.unlocks }
          : {}),
      } satisfies StartMissionResumeChecklistItem,
    ];
  });
  const followUpItems = followUps.flatMap((followUp) => {
    if (includedStepIds.has(followUp.id)) return [];
    includedStepIds.add(followUp.id);
    return [
      {
        id: `resume-${followUp.id}`,
        kind: 'run_follow_up',
        phaseId: followUp.phaseId,
        stepId: followUp.id,
        status: followUp.status,
        label: followUp.label,
        ...(followUp.command ? { command: followUp.command } : {}),
        ...(followUp.tool ? { tool: followUp.tool } : {}),
        ...(followUp.args ? { args: followUp.args } : {}),
        ...(followUp.blockedBy && followUp.blockedBy.length > 0
          ? { blockedBy: followUp.blockedBy }
          : {}),
        ...(followUp.dependsOn && followUp.dependsOn.length > 0
          ? { dependsOn: followUp.dependsOn }
          : {}),
      } satisfies StartMissionResumeChecklistItem,
    ];
  });
  const currentCommand = current?.step.command;
  const proofItems = stepsForPhase(plan, 'proof')
    .filter(({ step }) => step.command && step.command !== currentCommand)
    .map(({ phase, step }) => resumeChecklistItemFromStep(phase, step, 'run_proof', step.id));
  const doneItems = stepsForPhase(plan, 'done_when').map(({ phase, step }) =>
    resumeChecklistItemFromStep(phase, step, 'confirm_done', step.id),
  );
  return [
    ...(currentItem ? [currentItem] : []),
    ...inputItems,
    ...followUpItems,
    ...proofItems,
    ...doneItems,
  ];
}

function resumeChecklistItemFromStep(
  phase: StartExecutionPhase,
  step: StartExecutionStep,
  kind: StartMissionResumeChecklistItem['kind'],
  stepId: string,
): StartMissionResumeChecklistItem {
  const item: StartMissionResumeChecklistItem = {
    id: `resume-${stepId}`,
    kind,
    phaseId: phase.id,
    stepId,
    status: step.status,
    label: step.label,
  };
  appendChecklistStepFields(item, step);
  return item;
}

function appendChecklistStepFields(
  item: StartMissionResumeChecklistItem,
  step: StartExecutionStep,
): void {
  addTruthyValue(item, 'command', step.command);
  addTruthyValue(item, 'tool', step.tool);
  addTruthyValue(item, 'args', step.args);
  addTruthyValue(item, 'placeholder', step.placeholder);
  addTruthyValue(item, 'instruction', step.instruction);
  addNonEmptyStrings(item, 'blockedBy', step.blockedBy);
  addNonEmptyStrings(item, 'dependsOn', step.dependsOn);
  addNonEmptyStrings(item, 'unlocks', step.unlocks);
}

function currentChecklistKind(step: StartExecutionStep): StartMissionResumeChecklistItem['kind'] {
  if (step.kind === 'input') return 'resolve_input';
  if (step.kind === 'proof') return 'run_proof';
  if (step.kind === 'criterion') return 'confirm_done';
  return 'run_current';
}

function resumeInputBindings(
  plan: StartExecutionPlan,
  cursor: StartExecutionCursor,
): StartMissionInputBinding[] {
  const ids = uniqueStrings([
    ...(cursor.kind === 'input' ? [cursor.stepId] : []),
    ...(cursor.unlocks ?? []),
  ]);
  return ids.flatMap((id) => {
    const found = findStepInPlan(plan, id);
    if (!found || found.step.kind !== 'input' || !found.step.placeholder || !found.step.instruction)
      return [];
    const followUpIds = (found.step.unlocks ?? []).filter(
      (unlockedId) => findStepInPlan(plan, unlockedId)?.phase.id === 'follow_up',
    );
    return [
      {
        inputId: found.step.id,
        label: found.step.label,
        placeholder: found.step.placeholder,
        instruction: found.step.instruction,
        followUpIds,
      },
    ];
  });
}

function resumeFollowUps(
  plan: StartExecutionPlan,
  cursor: StartExecutionCursor,
): NonNullable<StartMissionResume['followUps']> {
  const followUpIds = new Set<string>();
  for (const id of cursor.unlocks ?? []) {
    const found = findStepInPlan(plan, id);
    if (!found) continue;
    if (found.phase.id === 'follow_up') followUpIds.add(found.step.id);
    for (const unlockedId of found.step.unlocks ?? []) {
      const unlocked = findStepInPlan(plan, unlockedId);
      if (unlocked?.phase.id === 'follow_up') followUpIds.add(unlocked.step.id);
    }
  }
  return Array.from(followUpIds).flatMap((id) => {
    const found = findStepInPlan(plan, id);
    if (!found) return [];
    return [
      {
        id: found.step.id,
        phaseId: found.phase.id,
        kind: found.step.kind,
        status: found.step.status,
        label: found.step.label,
        ...(found.step.command ? { command: found.step.command } : {}),
        ...(found.step.tool ? { tool: found.step.tool } : {}),
        ...(found.step.args ? { args: found.step.args } : {}),
        ...(found.step.blockedBy && found.step.blockedBy.length > 0
          ? { blockedBy: found.step.blockedBy }
          : {}),
        ...(found.step.dependsOn && found.step.dependsOn.length > 0
          ? { dependsOn: found.step.dependsOn }
          : {}),
      },
    ];
  });
}

function resumeToolCall(
  plan: StartExecutionPlan,
  cursor: StartExecutionCursor,
): StartMissionResume['toolCall'] | undefined {
  const found = findStepInPlan(plan, cursor.stepId);
  if (!found?.step.tool || !argsAreReady(found.step.args)) return undefined;
  return {
    tool: found.step.tool,
    ...(typeof found.step.args !== 'undefined' ? { args: found.step.args } : {}),
  };
}

function resolveResumeReferences(
  plan: StartExecutionPlan,
  ids: string[] | undefined,
): StartMissionResumeReference[] {
  if (!ids || ids.length === 0) return [];
  const references: StartMissionResumeReference[] = [];
  for (const id of ids) {
    const found = findStepInPlan(plan, id);
    if (!found) continue;
    references.push({
      id: found.step.id,
      phaseId: found.phase.id,
      kind: found.step.kind,
      status: found.step.status,
      label: found.step.label,
      ...(found.step.instruction ? { instruction: found.step.instruction } : {}),
      ...(found.step.command ? { command: found.step.command } : {}),
      ...(found.step.placeholder ? { placeholder: found.step.placeholder } : {}),
    });
  }
  return references;
}

function findStepInPlan(
  plan: StartExecutionPlan,
  id: string,
): { phase: StartExecutionPhase; step: StartExecutionStep } | undefined {
  for (const phase of plan.phases) {
    for (const step of phase.steps) {
      if (step.id === id) return { phase, step };
    }
  }
  return undefined;
}

function stepsForPhase(
  plan: StartExecutionPlan,
  phaseId: StartExecutionPhaseId,
): Array<{ phase: StartExecutionPhase; step: StartExecutionStep }> {
  const phase = plan.phases.find((item) => item.id === phaseId);
  return phase ? phase.steps.map((step) => ({ phase, step })) : [];
}

function resumeUnlocksSentence(
  unlocks: StartMissionResumeReference[],
  rawIds: string[] | undefined,
): string {
  if (unlocks.length > 0)
    return ` This can unlock ${unlocks.map(formatResumeReferenceLabel).join(', ')}.`;
  return rawIds && rawIds.length > 0 ? ` This can unlock ${rawIds.join(', ')}.` : '';
}

function resumeBlockersSentence(
  blockedBy: StartMissionResumeReference[],
  rawIds: string[] | undefined,
): string {
  if (blockedBy.length > 0)
    return ` Blocked by ${blockedBy.map(formatResumeReferenceLabel).join(', ')}.`;
  return rawIds && rawIds.length > 0 ? ` Blocked by ${rawIds.join(', ')}.` : '';
}

function formatResumeReferenceLabel(reference: StartMissionResumeReference): string {
  return `${reference.id} (${reference.label})`;
}

export function executionCursor(phases: StartExecutionPhase[]): StartExecutionCursor {
  const selected = selectExecutionStep(phases);
  return selected ? executionCursorFromSelection(selected) : fallbackExecutionCursor();
}

function selectExecutionStep(phases: StartExecutionPhase[]): FoundExecutionStep | undefined {
  for (const selector of CURSOR_SELECTORS) {
    const selected = findExecutionStep(phases, selector);
    if (selected) return selected;
  }
  return undefined;
}

function fallbackExecutionCursor(): StartExecutionCursor {
  return {
    phaseId: 'done_when',
    stepId: 'criterion-1',
    status: 'pending',
    kind: 'criterion',
    label: 'The next action is complete and verified.',
    reason: 'Use this criterion to decide when the task is complete.',
  };
}

function executionCursorFromSelection(selected: FoundExecutionStep): StartExecutionCursor {
  const cursor: StartExecutionCursor = {
    phaseId: selected.phase.id,
    stepId: selected.step.id,
    status: selected.step.status,
    kind: selected.step.kind,
    label: selected.step.label,
    reason: executionCursorReason(selected.step),
  };
  appendCursorStepFields(cursor, selected.step);
  return cursor;
}

function appendCursorStepFields(cursor: StartExecutionCursor, step: StartExecutionStep): void {
  addTruthyValue(cursor, 'command', step.command);
  addTruthyValue(cursor, 'tool', step.tool);
  addDefinedValue(cursor, 'args', step.args);
  addTruthyValue(cursor, 'instruction', step.instruction);
  addTruthyValue(cursor, 'placeholder', step.placeholder);
  addNonEmptyStrings(cursor, 'blockedBy', step.blockedBy);
  addNonEmptyStrings(cursor, 'unlocks', step.unlocks);
}

function findExecutionStep(
  phases: StartExecutionPhase[],
  predicate: (phase: StartExecutionPhase, step: StartExecutionStep) => boolean,
): { phase: StartExecutionPhase; step: StartExecutionStep } | undefined {
  for (const phase of phases) {
    for (const step of phase.steps) {
      if (predicate(phase, step)) return { phase, step };
    }
  }
  return undefined;
}

function executionCursorReason(step: StartExecutionStep): string {
  return (
    CURSOR_REASON_RULES.find((rule) => rule.matches(step))?.reason(step) ??
    'Use this step as the current execution pointer.'
  );
}

export function argsAreReady(value: unknown): boolean {
  if (typeof value === 'string') return !isPlaceholder(value);
  if (Array.isArray(value)) return value.every(argsAreReady);
  if (value && typeof value === 'object') return Object.values(value).every(argsAreReady);
  return true;
}

export function isRunnableCommand(command: string): boolean {
  return !/<[^<>]+>/.test(command);
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function addTruthyValue<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value) target[key] = value;
}

function addDefinedValue<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (typeof value !== 'undefined') target[key] = value;
}

function addNonEmptyStrings<T extends object, K extends keyof T>(
  target: T,
  key: K,
  values: string[] | undefined,
): void {
  if (values && values.length > 0) target[key] = values as T[K];
}
