import chalk from 'chalk';

import { printMissionControl } from './startConsoleMission.js';
import type { StartReport, StartRisk } from '../../types/start.js';

export { formatConsoleChecklistItem } from './startConsoleExecution.js';

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

function printRisk(risk: StartRisk): void {
  const files = risk.files.length > 0 ? ` (${risk.files.join(', ')})` : '';
  console.log(`- [${risk.priority}] ${risk.title}${files}`);
  console.log(`  ${risk.command}`);
}
