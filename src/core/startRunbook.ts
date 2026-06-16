import { formatMissionReviewDecision } from './startReviewGate.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type {
  StartExecutionCursor,
  StartExecutionPhaseId,
  StartExecutionPlan,
  StartMissionControlStatus,
  StartMissionInputBinding,
  StartMissionProofItem,
  StartMissionProofToolCall,
  StartMissionResume,
  StartMissionResumeChecklistItem,
  StartMissionResumeReference,
  StartMissionRunbook,
  StartMissionTaskCard,
  StartMissionToolCall,
  StartMissionReviewGate,
  StartUnresolvedInput,
} from '../types/start.js';

export function buildMissionRunbook(input: {
  intent?: string;
  status: StartMissionControlStatus;
  primaryAction: PreflightSuggestedAction;
  readyActions: PreflightSuggestedAction[];
  unresolvedInputs: StartUnresolvedInput[];
  successCriteria: string[];
  proofCommands: string[];
  executionPlan: StartExecutionPlan;
  resume: StartMissionResume;
  handoffPrompt: string;
  reviewGate: StartMissionReviewGate;
}): StartMissionRunbook {
  const readyCommands = uniqueStrings(
    input.readyActions.map((action) => action.command ?? '').filter(isRunnableCommand),
  );
  const readyCommandBlock = readyCommands.join('\n');
  const blockedInputSummary =
    input.unresolvedInputs.length > 0
      ? `Needs input: ${input.unresolvedInputs.map((item) => `${item.name}=${item.placeholder}`).join(', ')}.`
      : undefined;
  return {
    title: `Runbook: ${input.primaryAction.label}`,
    status: input.status,
    currentPhase: input.executionPlan.currentPhase,
    currentStep: input.executionPlan.cursor,
    resume: input.resume,
    readyCommandBlock,
    ...(blockedInputSummary ? { blockedInputSummary } : {}),
    markdown: renderMissionRunbookMarkdown({
      intent: input.intent,
      status: input.status,
      currentPhase: input.executionPlan.currentPhase,
      currentStep: input.executionPlan.cursor,
      resume: input.resume,
      primaryAction: input.primaryAction,
      readyCommands,
      unresolvedInputs: input.unresolvedInputs,
      proofCommands: input.proofCommands,
      successCriteria: input.successCriteria,
      handoffPrompt: input.handoffPrompt,
      reviewGate: input.reviewGate,
    }),
  };
}

export function buildMissionTaskCard(input: {
  intent?: string;
  status: StartMissionControlStatus;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  successCriteria: string[];
  handoffPrompt: string;
  reviewGate: StartMissionReviewGate;
}): StartMissionTaskCard {
  return {
    title: 'Mission Task Card',
    status: input.status,
    currentPhase: input.currentStep.phaseId,
    currentStep: input.currentStep,
    markdown: renderMissionTaskCardMarkdown(input),
  };
}

function renderMissionRunbookMarkdown(input: {
  intent?: string;
  status: StartMissionControlStatus;
  currentPhase: StartExecutionPhaseId;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  primaryAction: PreflightSuggestedAction;
  readyCommands: string[];
  unresolvedInputs: StartUnresolvedInput[];
  proofCommands: string[];
  successCriteria: string[];
  handoffPrompt: string;
  reviewGate: StartMissionReviewGate;
}): string {
  const lines = [
    '# Mission Runbook',
    '',
    ...(input.intent ? [`Intent: ${input.intent}`] : []),
    `Status: ${input.status}`,
    `Current phase: ${input.currentPhase}`,
    `Next action: ${input.primaryAction.command ? `\`${input.primaryAction.command}\`` : input.primaryAction.label}`,
    '',
    ...renderRunbookCursorLines(input.currentStep),
    '',
    ...renderRunbookResumeLines(input.resume),
    '',
    '## Handoff Prompt',
    input.handoffPrompt,
    '',
    '## Review Gate',
    ...input.reviewGate.checklist.map((item) => `- [ ] ${item}`),
    '',
    '## Reviewer Decision',
    ...input.reviewGate.decisions.map(formatMissionReviewDecision),
    '',
    input.reviewGate.reviewPrompt,
    '',
    '## Ready Commands',
    ...(input.readyCommands.length > 0
      ? input.readyCommands.map((command) => `- \`${command}\``)
      : ['- None yet. Resolve blocked inputs first.']),
    '',
    ...(input.unresolvedInputs.length > 0
      ? [
          '## Blocked Inputs',
          ...input.unresolvedInputs.map((item) => `- ${item.name}: ${item.instruction}`),
          '',
        ]
      : []),
    '## Proof Commands',
    ...(input.proofCommands.length > 0
      ? input.proofCommands.map((command) => `- \`${command}\``)
      : ['- No proof commands available yet.']),
    '',
    '## Done When',
    ...(input.successCriteria.length > 0
      ? input.successCriteria.map((criterion) => `- ${criterion}`)
      : ['- The next action is complete and verified.']),
  ];
  return `${lines.join('\n')}\n`;
}

function renderMissionTaskCardMarkdown(input: {
  intent?: string;
  status: StartMissionControlStatus;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  successCriteria: string[];
  handoffPrompt: string;
  reviewGate: StartMissionReviewGate;
}): string {
  const lines = [
    '# Mission Task Card',
    '',
    ...(input.intent ? [`Intent: ${input.intent}`] : []),
    `Status: ${input.status}`,
    `Current step: ${input.currentStep.stepId} in ${input.currentStep.phaseId}`,
    '',
    '## Do Next',
    ...missionTaskCardActionLines(input.resume),
    '',
    '## Proof',
    ...missionTaskCardProofLines(input.resume),
    '',
    '## Done When',
    ...(input.successCriteria.length > 0
      ? input.successCriteria.map((criterion) => `- [ ] ${criterion}`)
      : ['- [ ] The next action is complete and verified.']),
    '',
    '## Review Gate',
    ...input.reviewGate.checklist.map((item) => `- [ ] ${item}`),
    '',
    '## Reviewer Decision',
    ...input.reviewGate.decisions.map(formatMissionReviewDecision),
    '',
    '## Handoff Prompt',
    input.handoffPrompt,
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function missionTaskCardActionLines(resume: StartMissionResume): string[] {
  const checklist = resume.checklist ?? [];
  const actionLines = checklist
    .filter((item) => item.kind !== 'run_proof' && item.kind !== 'confirm_done')
    .map(formatTaskCardChecklistItem);
  return actionLines.length > 0
    ? actionLines
    : ['- [ ] Continue from the current Mission Control cursor.'];
}

function missionTaskCardProofLines(resume: StartMissionResume): string[] {
  const proofItems = resume.remainingProofItems ?? [];
  const proofLines = proofItems.map(formatTaskCardProofItem);
  if (proofLines.length > 0) return proofLines;
  const commands = resume.remainingProofCommands ?? [];
  return commands.length > 0
    ? commands.map((command) => `- [ ] \`${command}\``)
    : ['- [ ] No proof commands are ready yet.'];
}

function formatTaskCardChecklistItem(item: StartMissionResumeChecklistItem): string {
  if (item.kind === 'resolve_input') {
    const label = item.label ? ` (\`${item.label}\`)` : '';
    const instruction = item.instruction ?? item.label;
    return `- [ ] Resolve \`${item.stepId}\`${label}: ${instruction}`;
  }
  if (item.kind === 'run_follow_up' && item.command) {
    const prefix = item.status === 'blocked' ? 'After inputs, run' : 'Then run';
    return `- [ ] ${prefix} \`${item.command}\`${formatTaskCardChecklistAnnotation(item)}`;
  }
  if (item.command) {
    return `- [ ] Run \`${item.command}\`${formatTaskCardChecklistAnnotation(item)}`;
  }
  return `- [ ] ${item.instruction ?? item.label}`;
}

function formatTaskCardChecklistAnnotation(item: StartMissionResumeChecklistItem): string {
  if (!item.tool) return '';
  return ` (MCP: ${formatTaskCardToolCall({ tool: item.tool, ...(typeof item.args !== 'undefined' ? { args: item.args } : {}) })})`;
}

function formatTaskCardProofItem(item: StartMissionProofItem): string {
  const annotation = item.toolCall
    ? ` (MCP: ${formatTaskCardToolCall(item.toolCall)})`
    : ' (CLI only)';
  return `- [ ] \`${item.command}\`${annotation}`;
}

function formatTaskCardToolCall(toolCall: StartMissionToolCall): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}

function renderRunbookResumeLines(resume: StartMissionResume): string[] {
  const lines = ['## Resume', ...runbookResumeActionLines(resume)];
  appendRunbookLine(
    lines,
    resume.toolCall ? `MCP call: ${formatRunbookToolCall(resume.toolCall)}` : undefined,
  );
  appendRunbookSection(
    lines,
    'After running, resolve:',
    resume.unlocks,
    (reference) => `- ${formatRunbookResumeReference(reference)}`,
  );
  appendRunbookSection(
    lines,
    'Template inputs:',
    resume.inputBindings,
    (binding) => `- ${formatRunbookInputBinding(binding)}`,
  );
  appendRunbookSection(
    lines,
    'Resume checklist:',
    resume.checklist,
    (item) => `- ${formatRunbookChecklistItem(item)}`,
  );
  appendRunbookSection(
    lines,
    'Proof queue:',
    resume.remainingProofItems,
    (item) => `- ${formatRunbookProofItem(item)}`,
  );
  appendRunbookSection(
    lines,
    'Remaining proof:',
    resume.remainingProofCommands,
    (command) => `- \`${command}\``,
  );
  appendRunbookSection(
    lines,
    'MCP proof calls:',
    resume.remainingProofToolCalls,
    (toolCall) => `- ${formatRunbookProofToolCall(toolCall)}`,
  );
  appendRunbookSection(
    lines,
    'Then use:',
    resume.followUps,
    (followUp) => `- ${formatRunbookFollowUp(followUp)}`,
  );
  appendRunbookSection(
    lines,
    'Blocked by:',
    resume.blockedBy,
    (reference) => `- ${formatRunbookResumeReference(reference)}`,
  );
  lines.push(`Prompt: ${resume.prompt}`);
  return lines;
}

function runbookResumeActionLines(resume: StartMissionResume): string[] {
  if (!resume.commandBlock) return [`Do now: ${resume.instruction}`];
  return ['Run now:', '```sh', resume.commandBlock, '```'];
}

function appendRunbookLine(lines: string[], line: string | undefined): void {
  if (line) lines.push(line);
}

function appendRunbookSection<T>(
  lines: string[],
  heading: string,
  items: T[] | undefined,
  format: (item: T) => string,
): void {
  if (items && items.length > 0) lines.push(heading, ...items.map(format));
}

function renderRunbookCursorLines(cursor: StartExecutionCursor): string[] {
  const lines = ['## Current Cursor', `- Step: ${cursor.stepId} in ${cursor.phaseId}`];
  if (cursor.command) {
    lines.push(`- Command: \`${cursor.command}\``);
  } else if (cursor.instruction) {
    lines.push(`- Input: ${cursor.instruction}`);
  } else {
    lines.push(`- Label: ${cursor.label}`);
  }
  if (cursor.tool) {
    lines.push(
      `- MCP call: ${formatRunbookToolCall({ tool: cursor.tool, ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}) })}`,
    );
  }
  if (cursor.blockedBy && cursor.blockedBy.length > 0) {
    lines.push(`- Blocked by: ${cursor.blockedBy.join(', ')}`);
  }
  if (cursor.unlocks && cursor.unlocks.length > 0) {
    lines.push(`- Unlocks: ${cursor.unlocks.join(', ')}`);
  }
  lines.push(`- Why: ${cursor.reason}`);
  return lines;
}

function formatRunbookResumeReference(reference: StartMissionResumeReference): string {
  const detail = reference.instruction ?? reference.command ?? reference.label;
  return `${reference.id} (${reference.label}): ${detail}`;
}

function formatRunbookInputBinding(binding: StartMissionInputBinding): string {
  return `${binding.placeholder} -> ${binding.inputId} (${binding.label}): ${binding.instruction}`;
}

function formatRunbookChecklistItem(item: StartMissionResumeChecklistItem): string {
  const action =
    item.command ??
    (item.placeholder && item.instruction
      ? `${item.placeholder} -> ${item.instruction}`
      : undefined) ??
    item.instruction ??
    item.label;
  return `[${item.status}] ${item.kind} ${item.stepId}: ${action}${formatRunbookChecklistAnnotation(item)}`;
}

function formatRunbookChecklistAnnotation(item: StartMissionResumeChecklistItem): string {
  if (item.tool) {
    return ` (MCP: ${formatRunbookToolCall({ tool: item.tool, ...(typeof item.args !== 'undefined' ? { args: item.args } : {}) })})`;
  }
  if (item.kind === 'run_proof' && item.command) return ' (CLI only)';
  return '';
}

function formatRunbookToolCall(toolCall: NonNullable<StartMissionResume['toolCall']>): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}

function formatRunbookProofToolCall(toolCall: StartMissionProofToolCall): string {
  return `${toolCall.stepId}: ${formatRunbookToolCall(toolCall)}`;
}

function formatRunbookProofItem(item: StartMissionProofItem): string {
  const proofAction = item.toolCall ? `MCP: ${formatRunbookToolCall(item.toolCall)}` : 'CLI only';
  return `${item.stepId}: \`${item.command}\` (${proofAction})`;
}

function formatRunbookFollowUp(
  followUp: NonNullable<StartMissionResume['followUps']>[number],
): string {
  const action =
    followUp.command ??
    (followUp.tool
      ? formatRunbookToolCall({
          tool: followUp.tool,
          ...(typeof followUp.args !== 'undefined' ? { args: followUp.args } : {}),
        })
      : followUp.label);
  return `${followUp.id} (${followUp.label}): ${action}`;
}

function isRunnableCommand(command: string): boolean {
  return !/<[^<>]+>/.test(command);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
