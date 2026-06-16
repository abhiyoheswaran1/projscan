import chalk from 'chalk';

import { formatConsoleChecklistItem, printStart } from './startConsole.js';
import {
  buildMissionScript,
  printMissionBundle,
  writeMissionBundle,
} from './startMissionBundle.js';
import {
  buildShortcutIndex,
  missionReviewReplyLines,
  missionShortcutOptions,
  nextToolCall,
  readyProofCommands,
  readyToolCalls,
  type StartShortcutCommandOptions,
} from './startShortcuts.js';
import type { ReportFormat } from '../../types.js';
import type { StartReport } from '../../types/start.js';
import type { WorkplanMode } from '../../types/workplan.js';

export interface StartOutputOptions {
  saveMission?: string;
  nextCommand?: boolean;
  nextToolCall?: boolean;
  readyToolCalls?: boolean;
  proofCommands?: boolean;
  checklist?: boolean;
  resumeJson?: boolean;
  handoffJson?: boolean;
  runbook?: boolean;
  taskCard?: boolean;
  reviewGate?: boolean;
  reviewGateJson?: boolean;
  reviewPolicy?: boolean;
  reviewReplies?: boolean;
  missionScript?: boolean;
  shortcuts?: boolean;
  shortcutsJson?: boolean;
  handoffPrompt?: boolean;
}

export interface StartOutputContext {
  rootPath: string;
  format: ReportFormat;
  mode?: WorkplanMode;
  intent?: string;
  options: StartOutputOptions;
}

interface StartOutputHandlerContext extends StartOutputContext {
  report: StartReport;
}

type StartOutputHandler = (context: StartOutputHandlerContext) => boolean;

const specialStartOutputHandlers: StartOutputHandler[] = [
  printNextCommandOnly,
  printNextToolCallOnly,
  printReadyToolCallsOnly,
  printProofCommandsOnly,
  printChecklistOnly,
  printResumeJsonOnly,
  printHandoffJsonOnly,
  printRunbookOnly,
  printTaskCardOnly,
  printReviewGateOnly,
  printReviewGateJsonOnly,
  printReviewPolicyOnly,
  printReviewRepliesOnly,
  printMissionScriptOnly,
  printShortcutsOnly,
  printShortcutsJsonOnly,
  printHandoffPromptOnly,
];

export async function handleStartOutput(
  report: StartReport,
  context: StartOutputContext,
): Promise<void> {
  if (await maybeWriteMissionBundle(report, context)) return;
  if (context.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const handled = specialStartOutputHandlers.some((handler) => handler({ ...context, report }));
  if (handled) return;
  printStart(report, startConsoleContext(report));
}

async function maybeWriteMissionBundle(
  report: StartReport,
  context: StartOutputContext,
): Promise<boolean> {
  const bundleDir = context.options.saveMission;
  if (typeof bundleDir !== 'string' || bundleDir.length === 0) return false;

  const missionBundle = await writeMissionBundle(
    context.rootPath,
    bundleDir,
    report,
    missionBundleContext(report),
  );
  if (context.format === 'json') {
    console.log(JSON.stringify({ missionBundle }, null, 2));
    return true;
  }
  printMissionBundle(missionBundle);
  return true;
}

function printNextCommandOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.nextCommand !== true) return false;
  const command = context.report.missionControl.executionPlan.cursor.command;
  if (!command) {
    console.error(chalk.red('No runnable Mission Control cursor command is available.'));
    process.exit(1);
  }
  console.log(command);
  return true;
}

function printNextToolCallOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.nextToolCall !== true) return false;
  const toolCall = nextToolCall(context.report);
  if (!toolCall) {
    console.error(chalk.red('No MCP-callable Mission Control cursor tool call is available.'));
    process.exit(1);
  }
  console.log(JSON.stringify(toolCall));
  return true;
}

function printReadyToolCallsOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.readyToolCalls !== true) return false;
  const toolCalls = readyToolCalls(context.report);
  if (toolCalls.length === 0) {
    console.error(chalk.red('No ready Mission Control MCP tool calls are available.'));
    process.exit(1);
  }
  console.log(JSON.stringify(toolCalls));
  return true;
}

function printProofCommandsOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.proofCommands !== true) return false;
  const commands = readyProofCommands(context.report);
  if (commands.length === 0) {
    console.error(chalk.red('No ready Mission Control proof commands are available.'));
    process.exit(1);
  }
  console.log(commands.join('\n'));
  return true;
}

function printChecklistOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.checklist !== true) return false;
  const checklist = context.report.missionControl.resume.checklist ?? [];
  if (checklist.length === 0) {
    console.error(chalk.red('No Mission Control resume checklist is available.'));
    process.exit(1);
  }
  for (const item of checklist) {
    console.log(`- ${formatConsoleChecklistItem(item)}`);
  }
  return true;
}

function printResumeJsonOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.resumeJson !== true) return false;
  console.log(JSON.stringify(context.report.missionControl.resume));
  return true;
}

function printHandoffJsonOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.handoffJson !== true) return false;
  console.log(JSON.stringify(context.report.missionControl.handoff));
  return true;
}

function printRunbookOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.runbook !== true) return false;
  const runbook = context.report.missionControl.runbook.markdown.trimEnd();
  if (runbook.length === 0) {
    console.error(chalk.red('No Mission Control runbook is available.'));
    process.exit(1);
  }
  console.log(runbook);
  return true;
}

function printTaskCardOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.taskCard !== true) return false;
  const taskCard = context.report.missionControl.taskCard.markdown.trimEnd();
  if (taskCard.length === 0) {
    console.error(chalk.red('No Mission Control task card is available.'));
    process.exit(1);
  }
  console.log(taskCard);
  return true;
}

function printReviewGateOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.reviewGate !== true) return false;
  const reviewGate = context.report.missionControl.reviewGate.markdown.trimEnd();
  if (reviewGate.length === 0) {
    console.error(chalk.red('No Mission Control review gate is available.'));
    process.exit(1);
  }
  console.log(reviewGate);
  return true;
}

function printReviewGateJsonOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.reviewGateJson !== true) return false;
  console.log(JSON.stringify(context.report.missionControl.reviewGate));
  return true;
}

function printReviewPolicyOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.reviewPolicy !== true) return false;
  console.log(JSON.stringify(context.report.missionControl.reviewGate.policy));
  return true;
}

function printReviewRepliesOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.reviewReplies !== true) return false;
  const replies = missionReviewReplyLines(context.report);
  if (replies.length === 0) {
    console.error(chalk.red('No Mission Control reviewer replies are available.'));
    process.exit(1);
  }
  console.log(replies.join('\n'));
  return true;
}

function printMissionScriptOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.missionScript !== true) return false;
  console.log(buildMissionScript(context.report, readyProofCommands(context.report)).trimEnd());
  return true;
}

function printShortcutsOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.shortcuts !== true) return false;
  const shortcutIndex = buildShortcutIndex(context.report, shortcutOptions(context));
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
  return true;
}

function printShortcutsJsonOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.shortcutsJson !== true) return false;
  console.log(JSON.stringify(buildShortcutIndex(context.report, shortcutOptions(context))));
  return true;
}

function printHandoffPromptOnly(context: StartOutputHandlerContext): boolean {
  if (context.options.handoffPrompt !== true) return false;
  console.log(context.report.missionControl.handoffPrompt);
  return true;
}

function shortcutOptions(context: StartOutputHandlerContext): StartShortcutCommandOptions {
  return {
    intent: context.intent,
    mode: context.mode,
  };
}

function missionBundleContext(report: StartReport) {
  return {
    nextToolCall: nextToolCall(report),
    readyToolCalls: readyToolCalls(report),
    proofCommands: readyProofCommands(report),
    reviewReplies: missionReviewReplyLines(report),
    shortcutIndex: buildShortcutIndex(report, missionShortcutOptions(report)),
  };
}

function startConsoleContext(report: StartReport) {
  return {
    proofCommands: readyProofCommands(report),
    reviewReplies: missionReviewReplyLines(report),
  };
}
