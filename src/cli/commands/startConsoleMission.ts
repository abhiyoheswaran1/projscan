import chalk from 'chalk';

import { formatConsoleToolCall, printExecutionPlan, printResumeChecklist } from './startConsoleExecution.js';
import type { StartMissionProofItem, StartReport } from '../../types/start.js';

export interface StartConsoleMissionContext {
  proofCommands: string[];
  reviewReplies: string[];
}

export function printMissionControl(
  report: StartReport,
  context: StartConsoleMissionContext,
): void {
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

function formatConsoleProofItem(item: StartMissionProofItem): string {
  const proofAction = item.toolCall ? `MCP: ${formatConsoleToolCall(item.toolCall)}` : 'CLI only';
  return `${item.stepId}: ${item.command} (${proofAction})`;
}

function routeEvidence(route: StartReport['missionControl']['routedIntent']): string {
  if (!route) return 'confidence: low; matched: none';
  return `confidence: ${route.confidence}; matched: ${route.matchedKeywords.join(', ') || 'none'}`;
}
