import chalk from 'chalk';

import type {
  StartExecutionStep,
  StartMissionProofItem,
  StartMissionResumeChecklistItem,
  StartMissionToolCall,
  StartReport,
  StartRisk,
} from '../../types/start.js';

export interface StartConsoleContext {
  proofCommands: string[];
  reviewReplies: string[];
}

const ADOPTION_FOLLOW_UP_STEP_IDS = new Set(['feedback-capture', 'adoption-proof']);

export function printStart(report: StartReport, context: StartConsoleContext): void {
  console.log(chalk.bold(`Start: ${report.mode}`));
  console.log(report.summary);
  console.log(`Mode: ${modeSourceLabel(report.modeSource)}`);
  console.log(chalk.dim(report.modeReason));
  console.log(`Health: ${report.evidence.healthScore}/100 (${report.evidence.qualityVerdict})`);
  console.log(`Workflow: ${report.recommendedWorkflow.name}`);
  console.log('');
  if (printDailyWorkflows(report)) console.log('');
  printMissionControl(report, context);
  if (report.handoff) {
    console.log('');
    printAgentRunbook(report);
  }
  console.log('');
  printFirstTenMinutes(report);
  console.log('');
  if (printAdoptionFollowUp(report)) console.log('');
  printCoordinationHints(report);
  console.log('');
  printNextCommands(report);
  console.log('');
  printTopRisks(report);
  printAdoptionLoop(report);
  printAdoptionGaps(report);
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

function printDailyWorkflows(report: StartReport): boolean {
  if (!report.dailyWorkflows || report.dailyWorkflows.length === 0) return false;
  console.log(chalk.bold('Daily Workflows'));
  for (const workflow of report.dailyWorkflows) {
    console.log(`- ${workflow.name}`);
    for (const command of workflow.commands) console.log(`  - ${command}`);
  }
  return true;
}

function printFirstTenMinutes(report: StartReport): void {
  console.log(chalk.bold('First 10 Minutes'));
  for (const step of firstTenMinuteConsoleSteps(report)) {
    console.log(`- ${step.label}: ${step.command}`);
  }
}

function printAdoptionFollowUp(report: StartReport): boolean {
  const steps = adoptionFollowUpConsoleSteps(report);
  if (steps.length === 0) return false;
  console.log(chalk.bold('Adoption Follow-Up'));
  for (const step of steps) {
    console.log(`- ${step.label}: ${step.command}`);
  }
  return true;
}

function firstTenMinuteConsoleSteps(
  report: StartReport,
): StartReport['firstTenMinutes']['commands'] {
  return report.firstTenMinutes.commands.filter((step) => !ADOPTION_FOLLOW_UP_STEP_IDS.has(step.id));
}

function adoptionFollowUpConsoleSteps(
  report: StartReport,
): StartReport['firstTenMinutes']['commands'] {
  return report.firstTenMinutes.commands.filter((step) => ADOPTION_FOLLOW_UP_STEP_IDS.has(step.id));
}

function printCoordinationHints(report: StartReport): void {
  console.log(chalk.bold('Coordination Hints'));
  for (const hint of report.coordinationHints) {
    console.log(`- ${hint.label}: ${hint.command}`);
  }
}

function printNextCommands(report: StartReport): void {
  console.log(chalk.bold('Next Commands'));
  for (const action of report.nextActions.slice(0, 5)) {
    if (action.command) console.log(`- ${action.command}`);
  }
}

function printTopRisks(report: StartReport): void {
  console.log(chalk.bold(startRiskSectionTitle(report)));
  for (const risk of report.topRisks.slice(0, 5)) printRisk(risk);
}

export function startRiskSectionTitle(report: StartReport): string {
  const visibleRisks = report.topRisks.slice(0, 5);
  const allVisibleRisksAreWatchItems =
    visibleRisks.length > 0 && visibleRisks.every((risk) => risk.priority === 'p2');
  if (
    allVisibleRisksAreWatchItems &&
    (report.evidence.qualityVerdict === 'healthy' || report.evidence.qualityVerdict === 'excellent')
  ) {
    return 'Watch List';
  }
  return 'Top Risks';
}

function printAdoptionLoop(report: StartReport): void {
  if (!report.adoptionLoop) return;
  console.log('');
  console.log(chalk.bold('Repeat Use Loop'));
  console.log(report.adoptionLoop.why);
  for (const command of report.adoptionLoop.nextCommands.slice(0, 3)) console.log('- ' + command);
}

function printAdoptionGaps(report: StartReport): void {
  if (report.adoptionGaps.length === 0) return;
  console.log('');
  console.log(chalk.bold('Adoption Gaps'));
  for (const gap of report.adoptionGaps.slice(0, 5)) {
    console.log(
      `- [${gap.status}] ${gap.title}: ${gap.summary}${gap.command ? ` (${gap.command})` : ''}`,
    );
  }
}

function printAgentRunbook(report: StartReport): void {
  console.log(chalk.bold('Agent Runbook'));
  console.log(report.missionControl.runbook.markdown.trimEnd());
}

function modeSourceLabel(source: StartReport['modeSource']): string {
  if (source === 'intent') return 'inferred from intent';
  if (source === 'explicit') return 'explicit';
  return 'default';
}

function printMissionControl(report: StartReport, context: StartConsoleContext): void {
  const mission = report.missionControl;
  console.log(chalk.bold('Mission Control'));
  if (mission.intent) console.log(`Intent: ${mission.intent}`);
  console.log(`Status: ${mission.status}`);
  console.log(mission.headline);
  printMissionRoute(report);
  if (mission.primaryAction.command) console.log(chalk.cyan(mission.primaryAction.command));
  console.log(chalk.dim(mission.whyNow));
  printExecutionPlan(report);
  printResumeChecklist(report);
  if (shouldPrintInlineHandoffSections(report)) {
    printHandoffPrompt(report);
    printReviewGate(report, context.reviewReplies);
  }
  printMissionOutcome(report);
  printMissionActionSections(report);
  printMissionAlternatives(report);
  printMissionSuccessCriteria(report);
  printMissionProof(report, context.proofCommands);
}

function shouldPrintInlineHandoffSections(report: StartReport): boolean {
  return Boolean(report.handoff) || report.missionControl.unresolvedInputs.length > 0;
}

function printMissionRoute(report: StartReport): void {
  const routedIntent = report.missionControl.routedIntent;
  if (!routedIntent) return;
  console.log(
    `Route: ${routedIntent.category} via ${routedIntent.tool} (${routeEvidence(routedIntent)})`,
  );
}

function printMissionActionSections(report: StartReport): void {
  const { actionPlan, readyActions } = report.missionControl;
  if (!sameConsoleActions(actionPlan, readyActions)) {
    printActionCommands('Action Plan', actionPlan, 4);
  }
  printActionCommands('Ready Now', readyActions, 4);
  printUnresolvedInputs(report);
}

function sameConsoleActions(
  left: StartReport['missionControl']['actionPlan'],
  right: StartReport['missionControl']['readyActions'],
): boolean {
  return (
    left.length === right.length &&
    left.every((action, index) => {
      const other = right[index];
      return (
        action.label === other?.label &&
        action.command === other.command &&
        action.tool === other.tool
      );
    })
  );
}

function printActionCommands(
  title: string,
  actions: StartReport['missionControl']['actionPlan'],
  limit: number,
): void {
  if (actions.length === 0) return;
  console.log(chalk.bold(title));
  for (const action of actions.slice(0, limit)) {
    if (action.command) console.log(`- ${action.label}: ${action.command}`);
  }
}

function printUnresolvedInputs(report: StartReport): void {
  const inputs = report.missionControl.unresolvedInputs;
  if (inputs.length === 0) return;
  console.log(chalk.bold('Needs Input'));
  for (const input of inputs.slice(0, 4)) {
    console.log(`- ${input.name}: replace ${input.placeholder} after ${input.sourceAction}`);
  }
}

function printMissionAlternatives(report: StartReport): void {
  const alternatives = report.missionControl.alternatives;
  if (!alternatives || alternatives.length === 0) return;
  console.log(chalk.bold('Also Consider'));
  for (const route of alternatives.slice(0, 3)) {
    console.log(`- ${route.category}: ${route.cli} (${routeEvidence(route)})`);
  }
}

function printMissionSuccessCriteria(report: StartReport): void {
  const criteria = report.missionControl.successCriteria;
  if (criteria.length === 0) return;
  console.log(chalk.bold('Done When'));
  for (const criterion of criteria.slice(0, 4)) {
    console.log(`- ${criterion}`);
  }
}

function printMissionProof(report: StartReport, proofCommands: string[]): void {
  const mission = report.missionControl;
  if (mission.proofCommands.length === 0) return;
  console.log(chalk.bold('Ready Proof'));
  console.log(chalk.dim(mission.proofSummary));
  for (const command of proofCommands.slice(0, 3)) {
    console.log(chalk.dim(`- ${command}`));
  }
  printProofQueue(mission.handoff.readyProof.items ?? []);
}

function printProofQueue(proofItems: StartMissionProofItem[]): void {
  if (proofItems.length === 0) return;
  console.log(chalk.bold('Proof Queue'));
  for (const item of proofItems) {
    console.log(chalk.dim(`- ${formatConsoleProofItem(item)}`));
  }
}

function printMissionOutcome(report: StartReport): void {
  const outcome = report.missionControl.outcome;
  if (!outcome) return;
  console.log(chalk.bold('Mission Outcome'));
  console.log(`Status: ${outcome.status}`);
  if (!outcome.available && outcome.reason) console.log(`Reason: ${outcome.reason}`);
  for (const item of outcome.whatChanged) console.log(`- Changed: ${item}`);
  for (const item of outcome.whatRemains) console.log(`- Remains: ${item}`);
  console.log(`Version candidate: ${outcome.versionCandidate.recommendation}`);
  console.log(chalk.dim(outcome.versionCandidate.summary));
}

function printHandoffPrompt(report: StartReport): void {
  const prompt = report.missionControl.handoffPrompt;
  if (prompt.length === 0) return;

  console.log(chalk.bold('Handoff Prompt'));
  console.log(chalk.dim(prompt));
}

function printReviewGate(report: StartReport, reviewReplies: string[]): void {
  const gate = report.missionControl.reviewGate;
  console.log(chalk.bold('Review Gate'));
  console.log(gate.stopCondition);
  for (const command of gate.commands) console.log(`- ${command}`);
  console.log(gate.worktree.summary);
  printReviewReplies(reviewReplies);
  const stopLine = gate.checklist.find((item) => item.startsWith('Stop and ask'));
  if (stopLine) console.log(chalk.dim(stopLine));
}

function printReviewReplies(replies: string[]): void {
  if (replies.length === 0) return;
  console.log(chalk.bold('Reviewer Replies'));
  for (const reply of replies) console.log(reply);
}

function printExecutionPlan(report: StartReport): void {
  const plan = report.missionControl.executionPlan;
  console.log(chalk.bold('Execution Plan'));
  console.log(chalk.dim(plan.summary));
  for (const phase of plan.phases.slice(0, 6)) {
    console.log(`- [${phase.status}] ${phase.title}`);
    for (const step of phase.steps.slice(0, 4)) printExecutionStep(step);
  }
  printExecutionCursor(report);
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

function printResumeChecklist(report: StartReport): void {
  const checklist = report.missionControl.resume.checklist ?? [];
  if (checklist.length === 0) return;

  console.log(chalk.bold('Resume Checklist'));
  for (const item of checklist) {
    console.log(chalk.dim(`- ${formatConsoleChecklistItem(item)}`));
  }
}

function formatConsoleChecklistAnnotation(item: StartMissionResumeChecklistItem): string {
  if (item.tool) {
    return ` (MCP: ${formatConsoleToolCall({ tool: item.tool, ...(typeof item.args !== 'undefined' ? { args: item.args } : {}) })})`;
  }
  if (item.kind === 'run_proof' && item.command) return ' (CLI only)';
  return '';
}

function formatConsoleProofItem(item: StartMissionProofItem): string {
  const proofAction = item.toolCall ? `MCP: ${formatConsoleToolCall(item.toolCall)}` : 'CLI only';
  return `${item.stepId}: ${item.command} (${proofAction})`;
}

function formatConsoleToolCall(toolCall: StartMissionToolCall): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}

function routeEvidence(route: StartReport['missionControl']['routedIntent']): string {
  if (!route) return 'confidence: low; matched: none';
  return `confidence: ${route.confidence}; matched: ${route.matchedKeywords.join(', ') || 'none'}`;
}

function printRisk(risk: StartRisk): void {
  const files = risk.files.length > 0 ? ` (${risk.files.join(', ')})` : '';
  console.log(`- [${risk.priority}] ${risk.title}${files}`);
  console.log(`  ${risk.command}`);
}
