import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeStartReport } from '../../core/start.js';
import { isWorkplanMode } from '../../core/workplan.js';
import type {
  StartMissionProofItem,
  StartMissionResumeChecklistItem,
  StartMissionToolCall,
  StartReport,
  StartRisk,
  WorkplanMode,
} from '../../types.js';

export function registerStart(): void {
  program
    .command('start')
    .description('Orient an engineer or agent with the next best workflow for this repo')
    .option('--mode <mode>', 'before_edit, before_commit, before_merge, refactor, release, bug_hunt, or hardening')
    .option('--intent <text>', 'plain-language goal to route into the next best action')
    .option('--max-tasks <count>', 'maximum workplan tasks to inspect', parsePositiveInt)
    .option('--max-risks <count>', 'maximum start risks to return', parsePositiveInt)
    .option('--include-handoff', 'include a compact handoff payload')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('start');
      const mode = parseMode(cmdOpts.mode);

      try {
        const report = await computeStartReport(getRootPath(), {
          mode,
          intent: typeof cmdOpts.intent === 'string' ? cmdOpts.intent : undefined,
          maxTasks: cmdOpts.maxTasks,
          maxRisks: cmdOpts.maxRisks,
          includeHandoff: cmdOpts.includeHandoff === true,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printStart(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function parseMode(value: unknown): WorkplanMode | undefined {
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'string' && isWorkplanMode(value)) return value;
  console.error(chalk.red(`Unsupported --mode ${String(value)}.`));
  console.error(chalk.dim('Supported modes: before_edit, before_commit, before_merge, refactor, release, bug_hunt, hardening'));
  process.exit(1);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}

function printStart(report: StartReport): void {
  console.log(chalk.bold(`Start: ${report.mode}`));
  console.log(report.summary);
  console.log(`Mode: ${modeSourceLabel(report.modeSource)}`);
  console.log(chalk.dim(report.modeReason));
  console.log(`Health: ${report.evidence.healthScore}/100 (${report.evidence.qualityVerdict})`);
  console.log(`Workflow: ${report.recommendedWorkflow.name}`);
  console.log('');
  printMissionControl(report);
  if (report.handoff) {
    console.log('');
    printAgentRunbook(report);
  }
  console.log('');
  console.log(chalk.bold('First 10 Minutes'));
  for (const step of report.firstTenMinutes.commands) {
    console.log(`- ${step.label}: ${step.command}`);
  }
  console.log('');
  console.log(chalk.bold('Coordination Hints'));
  for (const hint of report.coordinationHints) {
    console.log(`- ${hint.label}: ${hint.command}`);
  }
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const action of report.nextActions.slice(0, 5)) {
    if (action.command) console.log(`- ${action.command}`);
  }
  console.log('');
  console.log(chalk.bold('Top Risks'));
  for (const risk of report.topRisks.slice(0, 5)) printRisk(risk);
  if (report.adoptionLoop) {
    console.log('');
    console.log(chalk.bold('Repeat Use Loop'));
    console.log(report.adoptionLoop.why);
    for (const command of report.adoptionLoop.nextCommands.slice(0, 3)) console.log('- ' + command);
  }
  if (report.adoptionGaps.length > 0) {
    console.log('');
    console.log(chalk.bold('Adoption Gaps'));
    for (const gap of report.adoptionGaps.slice(0, 5)) {
      console.log(`- [${gap.status}] ${gap.title}: ${gap.summary}${gap.command ? ` (${gap.command})` : ''}`);
    }
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

function printMissionControl(report: StartReport): void {
  const mission = report.missionControl;
  console.log(chalk.bold('Mission Control'));
  if (mission.intent) console.log(`Intent: ${mission.intent}`);
  console.log(`Status: ${mission.status}`);
  console.log(mission.headline);
  if (mission.routedIntent) {
    console.log(`Route: ${mission.routedIntent.category} via ${mission.routedIntent.tool} (${routeEvidence(mission.routedIntent)})`);
  }
  if (mission.primaryAction.command) console.log(chalk.cyan(mission.primaryAction.command));
  console.log(chalk.dim(mission.whyNow));
  printExecutionPlan(report);
  printResumeChecklist(report);
  if (mission.actionPlan.length > 0) {
    console.log(chalk.bold('Action Plan'));
    for (const action of mission.actionPlan.slice(0, 4)) {
      if (action.command) console.log(`- ${action.label}: ${action.command}`);
    }
  }
  if (mission.readyActions.length > 0) {
    console.log(chalk.bold('Ready Now'));
    for (const action of mission.readyActions.slice(0, 4)) {
      if (action.command) console.log(`- ${action.label}: ${action.command}`);
    }
  }
  if (mission.unresolvedInputs.length > 0) {
    console.log(chalk.bold('Needs Input'));
    for (const input of mission.unresolvedInputs.slice(0, 4)) {
      console.log(`- ${input.name}: replace ${input.placeholder} after ${input.sourceAction}`);
    }
  }
  if (mission.alternatives && mission.alternatives.length > 0) {
    console.log(chalk.bold('Also Consider'));
    for (const route of mission.alternatives.slice(0, 3)) {
      console.log(`- ${route.category}: ${route.cli} (${routeEvidence(route)})`);
    }
  }
  if (mission.successCriteria.length > 0) {
    console.log(chalk.bold('Done When'));
    for (const criterion of mission.successCriteria.slice(0, 4)) {
      console.log(`- ${criterion}`);
    }
  }
  if (mission.proofCommands.length > 0) {
    console.log(chalk.bold('Ready Proof'));
    console.log(chalk.dim(mission.proofSummary));
    for (const command of mission.proofCommands.slice(0, 3)) {
      console.log(chalk.dim(`- ${command}`));
    }
    const proofItems = mission.handoff.readyProof.items ?? [];
    if (proofItems.length > 0) {
      console.log(chalk.bold('Proof Queue'));
      for (const item of proofItems) {
        console.log(chalk.dim(`- ${formatConsoleProofItem(item)}`));
      }
    }
  }
}

function printExecutionPlan(report: StartReport): void {
  const plan = report.missionControl.executionPlan;
  console.log(chalk.bold('Execution Plan'));
  console.log(chalk.dim(plan.summary));
  for (const phase of plan.phases.slice(0, 6)) {
    console.log(`- [${phase.status}] ${phase.title}`);
    for (const step of phase.steps.slice(0, 4)) {
      if (step.kind === 'input' && step.instruction) {
        console.log(`  - ${step.label}: ${step.instruction}`);
      } else if (step.kind === 'criterion') {
        console.log(`  - ${step.label}`);
      } else if (step.command && step.kind === 'proof') {
        console.log(`  - ${step.command}`);
      } else if (step.command) {
        console.log(`  - ${step.label}: ${step.command}`);
      } else {
        console.log(`  - ${step.label}`);
      }
      if (step.blockedBy && step.blockedBy.length > 0) {
        console.log(`    blocked by: ${step.blockedBy.join(', ')}`);
      }
    }
  }
  printExecutionCursor(report);
}

function printExecutionCursor(report: StartReport): void {
  const plan = report.missionControl.executionPlan;
  const cursor = plan.cursor;
  const phaseTitle = plan.phases.find((phase) => phase.id === cursor.phaseId)?.title ?? cursor.phaseId;
  console.log(chalk.bold('Run Cursor'));
  console.log(`next: ${cursor.stepId} in ${phaseTitle}`);
  if (cursor.command) {
    console.log(`command: ${cursor.command}`);
  } else if (cursor.instruction) {
    console.log(`input: ${cursor.instruction}`);
  } else {
    console.log(`step: ${cursor.label}`);
  }
  if (cursor.tool) {
    console.log(`MCP call: ${formatConsoleToolCall({ tool: cursor.tool, ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}) })}`);
  }
  if (cursor.blockedBy && cursor.blockedBy.length > 0) {
    console.log(`blocked by: ${cursor.blockedBy.join(', ')}`);
  }
  if (cursor.unlocks && cursor.unlocks.length > 0) {
    console.log(`unlocks: ${cursor.unlocks.join(', ')}`);
  }
  console.log(chalk.dim(cursor.reason));
}

function printResumeChecklist(report: StartReport): void {
  const checklist = report.missionControl.resume.checklist ?? [];
  if (checklist.length === 0) return;

  console.log(chalk.bold('Resume Checklist'));
  for (const item of checklist) {
    console.log(chalk.dim(`- ${formatConsoleChecklistItem(item)}`));
  }
}

function formatConsoleChecklistItem(item: StartMissionResumeChecklistItem): string {
  const action = item.command
    ?? (item.placeholder && item.instruction ? `${item.placeholder} -> ${item.instruction}` : undefined)
    ?? item.instruction
    ?? item.label;
  return `[${item.status}] ${item.kind} ${item.stepId}: ${action}${formatConsoleChecklistAnnotation(item)}`;
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
