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
    .option('--task-card', 'print only the Mission Control Markdown task card')
    .option('--review-gate', 'print only the Mission Control review gate')
    .option('--review-gate-json', 'print only the Mission Control review gate as JSON')
    .option('--review-policy', 'print only the Mission Control review policy as JSON')
    .option('--review-replies', 'print only the Mission Control reviewer reply choices')
    .option('--shortcuts', 'print the Mission Control shortcut command index')
    .option('--shortcuts-json', 'print the Mission Control shortcut command index as JSON')
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
        if (cmdOpts.taskCard === true) {
          printTaskCardOnly(report);
          return;
        }
        if (cmdOpts.reviewGate === true) {
          printReviewGateOnly(report);
          return;
        }
        if (cmdOpts.reviewGateJson === true) {
          printReviewGateJsonOnly(report);
          return;
        }
        if (cmdOpts.reviewPolicy === true) {
          printReviewPolicyOnly(report);
          return;
        }
        if (cmdOpts.reviewReplies === true) {
          printReviewRepliesOnly(report);
          return;
        }
        if (cmdOpts.shortcuts === true) {
          printShortcutsOnly(report, {
            intent: typeof cmdOpts.intent === 'string' ? cmdOpts.intent : undefined,
            mode,
          });
          return;
        }
        if (cmdOpts.shortcutsJson === true) {
          printShortcutsJsonOnly(report, {
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
  printReviewGate(report);
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
  const shortcutOptions = missionShortcutOptions(report);
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
  await fs.writeFile(path.join(targetDir, 'README.md'), missionBundleReadme(report, files), 'utf-8');
  await fs.writeFile(path.join(targetDir, 'next-command.txt'), missionBundleNextCommand(report), 'utf-8');
  await fs.writeFile(
    path.join(targetDir, 'next-tool-call.json'),
    JSON.stringify(nextToolCall(report) ?? null) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'handoff-prompt.txt'),
    report.missionControl.handoffPrompt.trimEnd() + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'resume-prompt.txt'),
    report.missionControl.resume.prompt.trimEnd() + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'task-card.md'),
    report.missionControl.taskCard.markdown,
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'review-gate.md'),
    report.missionControl.reviewGate.markdown,
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'review-gate.json'),
    JSON.stringify(report.missionControl.reviewGate, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'review-policy.json'),
    JSON.stringify(report.missionControl.reviewGate.policy, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'review-replies.txt'),
    missionReviewReplyLines(report).join('\n') + '\n',
    'utf-8',
  );
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
    path.join(targetDir, 'shortcuts.json'),
    JSON.stringify(buildShortcutIndex(report, shortcutOptions), null, 2) + '\n',
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
      name: 'README.md',
      path: path.join(targetDir, 'README.md'),
      description: 'Quickstart for humans opening the bundle.',
    },
    {
      name: 'next-command.txt',
      path: path.join(targetDir, 'next-command.txt'),
      description: 'Current shell command or resume instruction.',
    },
    {
      name: 'next-tool-call.json',
      path: path.join(targetDir, 'next-tool-call.json'),
      description: 'Current MCP tool call, or null when no mapped call exists.',
    },
    {
      name: 'handoff-prompt.txt',
      path: path.join(targetDir, 'handoff-prompt.txt'),
      description: 'Copyable prompt for handing this mission to another agent.',
    },
    {
      name: 'resume-prompt.txt',
      path: path.join(targetDir, 'resume-prompt.txt'),
      description: 'Focused prompt for resuming the current cursor.',
    },
    {
      name: 'task-card.md',
      path: path.join(targetDir, 'task-card.md'),
      description: 'Paste-ready Markdown task card for PRs, issues, and handoffs.',
    },
    {
      name: 'review-gate.md',
      path: path.join(targetDir, 'review-gate.md'),
      description: 'Stop-and-review gate for approving another slice, release, publish, or deploy.',
    },
    {
      name: 'review-gate.json',
      path: path.join(targetDir, 'review-gate.json'),
      description: 'Machine-readable review gate with policy, proof, decisions, and worktree evidence.',
    },
    {
      name: 'review-policy.json',
      path: path.join(targetDir, 'review-policy.json'),
      description: 'Machine-readable review approval boundary and blocked actions.',
    },
    {
      name: 'review-replies.txt',
      path: path.join(targetDir, 'review-replies.txt'),
      description: 'Copy-only reviewer reply choices for approving or redirecting the stopped mission.',
    },
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
      name: 'shortcuts.json',
      path: path.join(targetDir, 'shortcuts.json'),
      description: 'Machine-readable Mission Control shortcut command index.',
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

function missionBundleReadme(report: StartReport, files: MissionBundleFile[]): string {
  const mission = report.missionControl;
  const cursor = mission.executionPlan.cursor;
  const lines = [
    '# Mission Bundle',
    '',
    ...(mission.intent ? [`Intent: ${mission.intent}`] : []),
    `Mode: ${report.mode}`,
    `Status: ${mission.status}`,
    `Current step: ${cursor.stepId} in ${cursor.phaseId}`,
    '',
    '## Run Next',
    '',
  ];

  if (cursor.command) {
    lines.push('```sh', cursor.command, '```');
  } else {
    lines.push(mission.resume.instruction);
  }

  const toolCall = nextToolCall(report);
  if (toolCall) {
    lines.push('', `MCP call: \`${toolCall.tool} ${JSON.stringify(toolCall.args ?? {})}\``);
  }

  const reviewReplyLines = missionReviewReplyLines(report);
  if (reviewReplyLines.length > 0) {
    lines.push('', '## Reviewer Replies', '', ...reviewReplyLines);
  }

  lines.push('', '## Files');
  for (const file of files) {
    lines.push(`- \`${file.name}\`: ${file.description}`);
  }

  return lines.join('\n').trimEnd() + '\n';
}

function missionBundleNextCommand(report: StartReport): string {
  return `${report.missionControl.executionPlan.cursor.command ?? report.missionControl.resume.instruction}\n`;
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

function printTaskCardOnly(report: StartReport): void {
  const taskCard = report.missionControl.taskCard.markdown.trimEnd();
  if (taskCard.length === 0) {
    console.error(chalk.red('No Mission Control task card is available.'));
    process.exit(1);
  }
  console.log(taskCard);
}

function printReviewGateOnly(report: StartReport): void {
  const reviewGate = report.missionControl.reviewGate.markdown.trimEnd();
  if (reviewGate.length === 0) {
    console.error(chalk.red('No Mission Control review gate is available.'));
    process.exit(1);
  }
  console.log(reviewGate);
}

function printReviewGateJsonOnly(report: StartReport): void {
  console.log(JSON.stringify(report.missionControl.reviewGate));
}

function printReviewPolicyOnly(report: StartReport): void {
  console.log(JSON.stringify(report.missionControl.reviewGate.policy));
}

function printReviewRepliesOnly(report: StartReport): void {
  const replies = missionReviewReplyLines(report);
  if (replies.length === 0) {
    console.error(chalk.red('No Mission Control reviewer replies are available.'));
    process.exit(1);
  }
  console.log(replies.join('\n'));
}

interface StartShortcutCommandOptions {
  intent?: string;
  mode?: WorkplanMode;
}

interface StartShortcutEntry {
  id: string;
  label: string;
  command: string;
  description: string;
}

interface StartShortcutIndex {
  schemaVersion: 1;
  kind: 'projscan.start-shortcuts';
  currentCommand?: string;
  currentToolCall?: StartMissionToolCall;
  baseCommand: string;
  shortcuts: StartShortcutEntry[];
}

function printShortcutsOnly(report: StartReport, options: StartShortcutCommandOptions): void {
  const shortcutIndex = buildShortcutIndex(report, options);

  console.log(chalk.bold('Mission Shortcuts'));
  if (shortcutIndex.currentCommand) {
    console.log('Current command:');
    console.log(shortcutIndex.currentCommand);
    console.log('');
  }
  if (shortcutIndex.currentToolCall) {
    console.log('Current MCP tool call:');
    console.log(JSON.stringify(shortcutIndex.currentToolCall));
    console.log('');
  }
  console.log('Copy from here:');
  for (const shortcut of shortcutIndex.shortcuts) console.log(shortcut.command);
}

function printShortcutsJsonOnly(report: StartReport, options: StartShortcutCommandOptions): void {
  console.log(JSON.stringify(buildShortcutIndex(report, options)));
}

function buildShortcutIndex(report: StartReport, options: StartShortcutCommandOptions): StartShortcutIndex {
  const command = report.missionControl.executionPlan.cursor.command;
  const toolCall = nextToolCall(report);
  const entries: StartShortcutEntry[] = [
    shortcutEntry('next-command', 'Current shell command', '--next-command', 'Print only the current Mission Control cursor command.', options),
    shortcutEntry('next-tool-call', 'Current MCP tool call', '--next-tool-call', 'Print only the current Mission Control cursor MCP tool call as compact JSON.', options),
    shortcutEntry('ready-tool-calls', 'Ready MCP calls', '--ready-tool-calls', 'Print the current cursor and remaining MCP-callable proof queue as compact JSON.', options),
    shortcutEntry('proof-commands', 'Ready proof commands', '--proof-commands', 'Print only ready Mission Control proof commands.', options),
    shortcutEntry('checklist', 'Resume checklist', '--checklist', 'Print only the Mission Control resume checklist.', options),
    shortcutEntry('resume-json', 'Resume JSON', '--resume-json', 'Print only the structured Mission Control resume object.', options),
    shortcutEntry('handoff-json', 'Handoff JSON', '--handoff-json', 'Print only the structured Mission Control handoff object.', options),
    shortcutEntry('save-mission', 'Save mission bundle', '--save-mission .projscan/mission', 'Write the Mission Control bundle to .projscan/mission.', options),
    shortcutEntry('task-card', 'Task card', '--task-card', 'Print only the Mission Control Markdown task card.', options),
    shortcutEntry('review-gate', 'Review gate Markdown', '--review-gate', 'Print only the Mission Control stop-and-review gate.', options),
    shortcutEntry('review-gate-json', 'Review gate JSON', '--review-gate-json', 'Print only the Mission Control review gate as JSON.', options),
    shortcutEntry('review-policy', 'Review policy JSON', '--review-policy', 'Print only the Mission Control review policy as JSON.', options),
    shortcutEntry('review-replies', 'Reviewer replies', '--review-replies', 'Print only copyable Mission Control reviewer replies.', options),
    shortcutEntry('runbook', 'Mission runbook', '--runbook', 'Print only the Mission Control Markdown runbook.', options),
    shortcutEntry('handoff-prompt', 'Handoff prompt', '--handoff-prompt', 'Print only the concise Mission Control handoff prompt.', options),
    {
      id: 'start',
      label: 'Full start report',
      command: startBaseCommand(options),
      description: 'Print the full Mission Control start report.',
    },
  ];

  return {
    schemaVersion: 1,
    kind: 'projscan.start-shortcuts',
    ...(command ? { currentCommand: command } : {}),
    ...(toolCall ? { currentToolCall: toolCall } : {}),
    baseCommand: startBaseCommand(options),
    shortcuts: entries,
  };
}

function shortcutEntry(
  id: string,
  label: string,
  flag: string,
  description: string,
  options: StartShortcutCommandOptions,
): StartShortcutEntry {
  return {
    id,
    label,
    command: shortcutCommand(flag, options),
    description,
  };
}

function missionShortcutOptions(report: StartReport): StartShortcutCommandOptions {
  return {
    ...(report.modeSource === 'explicit' ? { mode: report.mode } : {}),
    ...(report.missionControl.intent ? { intent: report.missionControl.intent } : {}),
  };
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

function printReviewGate(report: StartReport): void {
  const gate = report.missionControl.reviewGate;
  console.log(chalk.bold('Review Gate'));
  console.log(gate.stopCondition);
  for (const command of gate.commands) console.log(`- ${command}`);
  console.log(gate.worktree.summary);
  printReviewReplies(report);
  const stopLine = gate.checklist.find((item) => item.startsWith('Stop and ask'));
  if (stopLine) console.log(chalk.dim(stopLine));
}

function missionReviewReplyLines(report: StartReport): string[] {
  return report.missionControl.reviewGate.decisions.map(
    (decision) => `- ${decision.label}: ${decision.reply}`,
  );
}

function printReviewReplies(report: StartReport): void {
  const replies = missionReviewReplyLines(report);
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
