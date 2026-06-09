import fs from 'node:fs/promises';
import path from 'node:path';
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
    .option('--handoff-prompt', 'print only the concise Mission Control handoff prompt')
    .option('--next-command', 'print only the current Mission Control cursor command')
    .option('--next-tool-call', 'print only the current Mission Control cursor MCP tool call as JSON')
    .option('--ready-tool-calls', 'print all currently ready Mission Control MCP tool calls as compact JSON')
    .option('--proof-commands', 'print only ready Mission Control proof commands')
    .option('--checklist', 'print only the Mission Control resume checklist')
    .option('--resume-json', 'print only the Mission Control resume object as compact JSON')
    .option('--handoff-json', 'print only the Mission Control handoff object as compact JSON')
    .option('--save-mission <dir>', 'write the Mission Control bundle to this directory')
    .option('--runbook', 'print only the Mission Control Markdown runbook')
    .option('--shortcuts', 'print the Mission Control shortcut command index')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('start');
      const mode = parseMode(cmdOpts.mode);
      const rootPath = getRootPath();

      try {
        const report = await computeStartReport(rootPath, {
          mode,
          intent: typeof cmdOpts.intent === 'string' ? cmdOpts.intent : undefined,
          maxTasks: cmdOpts.maxTasks,
          maxRisks: cmdOpts.maxRisks,
          includeHandoff: cmdOpts.includeHandoff === true,
        });

        if (typeof cmdOpts.saveMission === 'string' && cmdOpts.saveMission.length > 0) {
          const missionBundle = await writeMissionBundle(rootPath, cmdOpts.saveMission, report);
          if (format === 'json') {
            console.log(JSON.stringify({ missionBundle }, null, 2));
            return;
          }
          printMissionBundle(missionBundle);
          return;
        }
        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        if (cmdOpts.nextCommand === true) {
          const command = report.missionControl.executionPlan.cursor.command;
          if (!command) {
            console.error(chalk.red('No runnable Mission Control cursor command is available.'));
            process.exit(1);
          }
          console.log(command);
          return;
        }
        if (cmdOpts.nextToolCall === true) {
          const toolCall = nextToolCall(report);
          if (!toolCall) {
            console.error(chalk.red('No MCP-callable Mission Control cursor tool call is available.'));
            process.exit(1);
          }
          console.log(JSON.stringify(toolCall));
          return;
        }
        if (cmdOpts.readyToolCalls === true) {
          const toolCalls = readyToolCalls(report);
          if (toolCalls.length === 0) {
            console.error(chalk.red('No ready Mission Control MCP tool calls are available.'));
            process.exit(1);
          }
          console.log(JSON.stringify(toolCalls));
          return;
        }
        if (cmdOpts.proofCommands === true) {
          const commands = readyProofCommands(report);
          if (commands.length === 0) {
            console.error(chalk.red('No ready Mission Control proof commands are available.'));
            process.exit(1);
          }
          console.log(commands.join('\n'));
          return;
        }
        if (cmdOpts.checklist === true) {
          printChecklistOnly(report);
          return;
        }
        if (cmdOpts.resumeJson === true) {
          console.log(JSON.stringify(report.missionControl.resume));
          return;
        }
        if (cmdOpts.handoffJson === true) {
          console.log(JSON.stringify(report.missionControl.handoff));
          return;
        }
        if (cmdOpts.runbook === true) {
          printRunbookOnly(report);
          return;
        }
        if (cmdOpts.shortcuts === true) {
          printShortcutsOnly(report, {
            intent: typeof cmdOpts.intent === 'string' ? cmdOpts.intent : undefined,
            mode,
          });
          return;
        }
        if (cmdOpts.handoffPrompt === true) {
          console.log(report.missionControl.handoffPrompt);
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
  printHandoffPrompt(report);
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
    const proofCommands = readyProofCommands(report);
    for (const command of proofCommands.slice(0, 3)) {
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

function nextToolCall(report: StartReport): StartMissionToolCall | undefined {
  const resumeToolCall = report.missionControl.resume.toolCall;
  if (resumeToolCall) return resumeToolCall;
  const cursor = report.missionControl.executionPlan.cursor;
  if (!cursor.tool) return undefined;
  return {
    tool: cursor.tool,
    ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}),
  };
}

function readyToolCalls(report: StartReport): StartMissionToolCall[] {
  const calls: StartMissionToolCall[] = [];
  const current = nextToolCall(report);
  if (current) calls.push(compactToolCall(current));
  for (const proofCall of report.missionControl.handoff.readyProof.toolCalls ?? []) {
    calls.push(compactToolCall(proofCall));
  }
  return dedupeToolCalls(calls);
}

function compactToolCall(toolCall: StartMissionToolCall): StartMissionToolCall {
  return {
    tool: toolCall.tool,
    ...(typeof toolCall.args !== 'undefined' ? { args: toolCall.args } : {}),
  };
}

function dedupeToolCalls(toolCalls: StartMissionToolCall[]): StartMissionToolCall[] {
  const seen = new Set<string>();
  const out: StartMissionToolCall[] = [];
  for (const toolCall of toolCalls) {
    const key = JSON.stringify(toolCall);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toolCall);
  }
  return out;
}

function readyProofCommands(report: StartReport): string[] {
  const mission = report.missionControl;
  return mission.handoff.readyProof.commands.length > 0
    ? mission.handoff.readyProof.commands
    : mission.proofCommands;
}

interface MissionBundleFile {
  name: string;
  path: string;
  description: string;
}

interface MissionBundleManifest {
  schemaVersion: 1;
  kind: 'projscan.mission-bundle';
  directory: string;
  intent?: string;
  mode: StartReport['mode'];
  status: StartReport['missionControl']['status'];
  currentStep?: {
    phaseId: string;
    stepId: string;
    command?: string;
    toolCall?: StartMissionToolCall;
  };
  files: MissionBundleFile[];
}

async function writeMissionBundle(
  rootPath: string,
  bundleDir: string,
  report: StartReport,
): Promise<MissionBundleManifest> {
  const targetDir = path.resolve(rootPath, bundleDir);
  const files = missionBundleFiles(targetDir);
  const manifest: MissionBundleManifest = {
    schemaVersion: 1,
    kind: 'projscan.mission-bundle',
    directory: targetDir,
    ...(report.missionControl.intent ? { intent: report.missionControl.intent } : {}),
    mode: report.mode,
    status: report.missionControl.status,
    currentStep: missionBundleCurrentStep(report),
    files,
  };

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(
    path.join(targetDir, 'runbook.md'),
    report.missionControl.runbook.markdown.trimEnd() + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'handoff.json'),
    JSON.stringify(report.missionControl.handoff, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'resume.json'),
    JSON.stringify(report.missionControl.resume, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'ready-tool-calls.json'),
    JSON.stringify(readyToolCalls(report), null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'proof-commands.txt'),
    readyProofCommands(report).join('\n') + '\n',
    'utf-8',
  );
  await fs.writeFile(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  return manifest;
}

function missionBundleFiles(targetDir: string): MissionBundleFile[] {
  return [
    {
      name: 'runbook.md',
      path: path.join(targetDir, 'runbook.md'),
      description: 'Human-readable Mission Control runbook.',
    },
    {
      name: 'handoff.json',
      path: path.join(targetDir, 'handoff.json'),
      description: 'Structured Mission Control handoff object.',
    },
    {
      name: 'resume.json',
      path: path.join(targetDir, 'resume.json'),
      description: 'Focused resume object for the current cursor.',
    },
    {
      name: 'ready-tool-calls.json',
      path: path.join(targetDir, 'ready-tool-calls.json'),
      description: 'Current cursor MCP call followed by remaining MCP-callable proof.',
    },
    {
      name: 'proof-commands.txt',
      path: path.join(targetDir, 'proof-commands.txt'),
      description: 'Remaining ready proof commands, one per line.',
    },
    {
      name: 'manifest.json',
      path: path.join(targetDir, 'manifest.json'),
      description: 'Bundle index with mode, status, current step, and file paths.',
    },
  ];
}

function missionBundleCurrentStep(
  report: StartReport,
): MissionBundleManifest['currentStep'] {
  const cursor = report.missionControl.executionPlan.cursor;
  return {
    phaseId: cursor.phaseId,
    stepId: cursor.stepId,
    ...(cursor.command ? { command: cursor.command } : {}),
    ...(cursor.tool ? { toolCall: { tool: cursor.tool, ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}) } } : {}),
  };
}

function printMissionBundle(manifest: MissionBundleManifest): void {
  console.log(chalk.green(`Wrote Mission Control bundle to ${manifest.directory}`));
  for (const file of manifest.files) {
    console.log(`- ${file.name}`);
  }
}

function printChecklistOnly(report: StartReport): void {
  const checklist = report.missionControl.resume.checklist ?? [];
  if (checklist.length === 0) {
    console.error(chalk.red('No Mission Control resume checklist is available.'));
    process.exit(1);
  }
  for (const item of checklist) {
    console.log(`- ${formatConsoleChecklistItem(item)}`);
  }
}

function printRunbookOnly(report: StartReport): void {
  const runbook = report.missionControl.runbook.markdown.trimEnd();
  if (runbook.length === 0) {
    console.error(chalk.red('No Mission Control runbook is available.'));
    process.exit(1);
  }
  console.log(runbook);
}

interface StartShortcutCommandOptions {
  intent?: string;
  mode?: WorkplanMode;
}

function printShortcutsOnly(report: StartReport, options: StartShortcutCommandOptions): void {
  const command = report.missionControl.executionPlan.cursor.command;
  const toolCall = nextToolCall(report);
  const shortcuts = [
    shortcutCommand('--next-command', options),
    shortcutCommand('--next-tool-call', options),
    shortcutCommand('--ready-tool-calls', options),
    shortcutCommand('--proof-commands', options),
    shortcutCommand('--checklist', options),
    shortcutCommand('--resume-json', options),
    shortcutCommand('--handoff-json', options),
    shortcutCommand('--save-mission .projscan/mission', options),
    shortcutCommand('--runbook', options),
    shortcutCommand('--handoff-prompt', options),
    startBaseCommand(options),
  ];

  console.log(chalk.bold('Mission Shortcuts'));
  if (command) {
    console.log('Current command:');
    console.log(command);
    console.log('');
  }
  if (toolCall) {
    console.log('Current MCP tool call:');
    console.log(JSON.stringify(toolCall));
    console.log('');
  }
  console.log('Copy from here:');
  for (const shortcut of shortcuts) console.log(shortcut);
}

function shortcutCommand(flag: string, options: StartShortcutCommandOptions): string {
  return ['projscan start', flag, ...startCommandOptionArgs(options)].join(' ');
}

function startBaseCommand(options: StartShortcutCommandOptions): string {
  return ['projscan start', ...startCommandOptionArgs(options)].join(' ');
}

function startCommandOptionArgs(options: StartShortcutCommandOptions): string[] {
  const args: string[] = [];
  if (options.mode) args.push('--mode', shellQuote(options.mode));
  if (options.intent) args.push('--intent', shellQuote(options.intent));
  return args;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function printHandoffPrompt(report: StartReport): void {
  const prompt = report.missionControl.handoffPrompt;
  if (prompt.length === 0) return;

  console.log(chalk.bold('Handoff Prompt'));
  console.log(chalk.dim(prompt));
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
