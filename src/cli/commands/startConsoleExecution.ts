import chalk from 'chalk';

import type {
  StartExecutionStep,
  StartMissionResumeChecklistItem,
  StartMissionToolCall,
  StartReport,
} from '../../types/start.js';

export function printExecutionPlan(report: StartReport): void {
  const plan = report.missionControl.executionPlan;
  const phases = visibleExecutionPhases(plan.phases);
  console.log(chalk.bold('Execution Plan'));
  console.log(chalk.dim(plan.summary));
  for (const phase of phases.slice(0, 6)) {
    console.log(`- [${phase.status}] ${phase.title}`);
    for (const step of phase.steps.slice(0, 4)) printExecutionStep(step);
  }
  printExecutionCursor(report);
}

export function printResumeChecklist(report: StartReport): void {
  const checklist = report.missionControl.resume.checklist ?? [];
  if (checklist.length === 0) return;

  console.log(chalk.bold('Resume Checklist'));
  for (const item of checklist) {
    console.log(chalk.dim(`- ${formatConsoleChecklistItem(item)}`));
  }
}

export function formatConsoleChecklistItem(item: StartMissionResumeChecklistItem): string {
  const action =
    item.command ??
    (item.placeholder && item.instruction
      ? `${item.placeholder} -> ${item.instruction}`
      : undefined) ??
    item.instruction ??
    item.label;
  return `[${item.status}] ${item.kind} ${item.stepId}: ${action}${formatConsoleChecklistAnnotation(item)}`;
}

export function formatConsoleToolCall(toolCall: StartMissionToolCall): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}

function visibleExecutionPhases(
  phases: StartReport['missionControl']['executionPlan']['phases'],
): StartReport['missionControl']['executionPlan']['phases'] {
  if (!hasDuplicateNextActionPhase(phases)) return phases;
  return phases.filter((phase) => phase.id !== 'next_action');
}

function hasDuplicateNextActionPhase(
  phases: StartReport['missionControl']['executionPlan']['phases'],
): boolean {
  const nextAction = phases.find((phase) => phase.id === 'next_action');
  const readyNow = phases.find((phase) => phase.id === 'ready_now');
  return Boolean(nextAction && readyNow && sameExecutionSteps(nextAction.steps, readyNow.steps));
}

function sameExecutionSteps(left: StartExecutionStep[], right: StartExecutionStep[]): boolean {
  return (
    left.length === right.length &&
    left.every((step, index) => {
      const other = right[index];
      return step.label === other?.label && step.command === other.command && step.tool === other.tool;
    })
  );
}

function printExecutionStep(step: StartExecutionStep): void {
  console.log(executionStepLine(step));
  if (step.blockedBy && step.blockedBy.length > 0) {
    console.log(`    blocked by: ${step.blockedBy.join(', ')}`);
  }
}

function executionStepLine(step: StartExecutionStep): string {
  if (step.kind === 'input' && step.instruction) return `  - ${step.label}: ${step.instruction}`;
  if (step.kind === 'criterion') return `  - ${step.label}`;
  if (step.command && step.kind === 'proof') return `  - ${step.command}`;
  if (step.command) return `  - ${step.label}: ${step.command}`;
  return `  - ${step.label}`;
}

function printExecutionCursor(report: StartReport): void {
  const plan = report.missionControl.executionPlan;
  const cursor = plan.cursor;
  const phaseTitle =
    plan.phases.find((phase) => phase.id === cursor.phaseId)?.title ?? cursor.phaseId;
  console.log(chalk.bold('Run Cursor'));
  console.log(`next: ${cursor.stepId} in ${phaseTitle}`);
  printExecutionCursorAction(cursor);
  if (cursor.tool) {
    console.log(
      `MCP call: ${formatConsoleToolCall({ tool: cursor.tool, ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}) })}`,
    );
  }
  if (cursor.blockedBy && cursor.blockedBy.length > 0) {
    console.log(`blocked by: ${cursor.blockedBy.join(', ')}`);
  }
  if (cursor.unlocks && cursor.unlocks.length > 0) {
    console.log(`unlocks: ${cursor.unlocks.join(', ')}`);
  }
  console.log(chalk.dim(cursor.reason));
}

function printExecutionCursorAction(
  cursor: StartReport['missionControl']['executionPlan']['cursor'],
): void {
  if (cursor.command) {
    console.log(`command: ${cursor.command}`);
  } else if (cursor.instruction) {
    console.log(`input: ${cursor.instruction}`);
  } else {
    console.log(`step: ${cursor.label}`);
  }
}

function formatConsoleChecklistAnnotation(item: StartMissionResumeChecklistItem): string {
  if (item.tool) {
    return ` (MCP: ${formatConsoleToolCall({ tool: item.tool, ...(typeof item.args !== 'undefined' ? { args: item.args } : {}) })})`;
  }
  if (item.kind === 'run_proof' && item.command) return ' (CLI only)';
  return '';
}
