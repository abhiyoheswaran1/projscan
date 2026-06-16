import type { StartMissionToolCall, StartReport } from '../../types/start.js';
import type { WorkplanMode } from '../../types/workplan.js';

export interface StartShortcutCommandOptions {
  intent?: string;
  mode?: WorkplanMode;
}

export interface StartShortcutEntry {
  id: string;
  label: string;
  command: string;
  description: string;
}

export interface StartShortcutIndex {
  schemaVersion: 1;
  kind: 'projscan.start-shortcuts';
  currentCommand?: string;
  currentToolCall?: StartMissionToolCall;
  baseCommand: string;
  shortcuts: StartShortcutEntry[];
}

export function buildShortcutIndex(
  report: StartReport,
  options: StartShortcutCommandOptions,
): StartShortcutIndex {
  const command = report.missionControl.executionPlan.cursor.command;
  const toolCall = nextToolCall(report);
  const entries: StartShortcutEntry[] = [
    shortcutEntry(
      'next-command',
      'Current shell command',
      '--next-command',
      'Print only the current Mission Control cursor command.',
      options,
    ),
    shortcutEntry(
      'next-tool-call',
      'Current MCP tool call',
      '--next-tool-call',
      'Print only the current Mission Control cursor MCP tool call as compact JSON.',
      options,
    ),
    shortcutEntry(
      'ready-tool-calls',
      'Ready MCP calls',
      '--ready-tool-calls',
      'Print the current cursor and remaining MCP-callable proof queue as compact JSON.',
      options,
    ),
    shortcutEntry(
      'proof-commands',
      'Ready proof commands',
      '--proof-commands',
      'Print only ready Mission Control proof commands.',
      options,
    ),
    shortcutEntry(
      'checklist',
      'Resume checklist',
      '--checklist',
      'Print only the Mission Control resume checklist.',
      options,
    ),
    shortcutEntry(
      'resume-json',
      'Resume JSON',
      '--resume-json',
      'Print only the structured Mission Control resume object.',
      options,
    ),
    shortcutEntry(
      'handoff-json',
      'Handoff JSON',
      '--handoff-json',
      'Print only the structured Mission Control handoff object.',
      options,
    ),
    shortcutEntry(
      'mission-script',
      'Mission script',
      '--mission-script',
      'Print the Mission Control shell script.',
      options,
    ),
    shortcutEntry(
      'save-mission',
      'Save mission bundle',
      '--save-mission .projscan/mission',
      'Write the Mission Control bundle to .projscan/mission.',
      options,
    ),
    shortcutEntry(
      'task-card',
      'Task card',
      '--task-card',
      'Print only the Mission Control Markdown task card.',
      options,
    ),
    shortcutEntry(
      'review-gate',
      'Review gate Markdown',
      '--review-gate',
      'Print only the Mission Control stop-and-review gate.',
      options,
    ),
    shortcutEntry(
      'review-gate-json',
      'Review gate JSON',
      '--review-gate-json',
      'Print only the Mission Control review gate as JSON.',
      options,
    ),
    shortcutEntry(
      'review-policy',
      'Review policy JSON',
      '--review-policy',
      'Print only the Mission Control review policy as JSON.',
      options,
    ),
    shortcutEntry(
      'review-replies',
      'Reviewer replies',
      '--review-replies',
      'Print only copyable Mission Control reviewer replies.',
      options,
    ),
    shortcutEntry(
      'runbook',
      'Mission runbook',
      '--runbook',
      'Print only the Mission Control Markdown runbook.',
      options,
    ),
    shortcutEntry(
      'handoff-prompt',
      'Handoff prompt',
      '--handoff-prompt',
      'Print only the concise Mission Control handoff prompt.',
      options,
    ),
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

export function missionShortcutOptions(report: StartReport): StartShortcutCommandOptions {
  return {
    ...(report.modeSource === 'explicit' ? { mode: report.mode } : {}),
    ...(report.missionControl.intent ? { intent: report.missionControl.intent } : {}),
  };
}

export function nextToolCall(report: StartReport): StartMissionToolCall | undefined {
  const resumeToolCall = report.missionControl.resume.toolCall;
  if (resumeToolCall) return resumeToolCall;
  const cursor = report.missionControl.executionPlan.cursor;
  if (!cursor.tool) return undefined;
  return {
    tool: cursor.tool,
    ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}),
  };
}

export function readyToolCalls(report: StartReport): StartMissionToolCall[] {
  const calls: StartMissionToolCall[] = [];
  const current = nextToolCall(report);
  if (current) calls.push(compactToolCall(current));
  for (const proofCall of report.missionControl.handoff.readyProof.toolCalls ?? []) {
    calls.push(compactToolCall(proofCall));
  }
  return dedupeToolCalls(calls);
}

export function readyProofCommands(report: StartReport): string[] {
  const mission = report.missionControl;
  return mission.handoff.readyProof.commands.length > 0
    ? mission.handoff.readyProof.commands
    : mission.proofCommands;
}

export function missionReviewReplyLines(report: StartReport): string[] {
  return report.missionControl.reviewGate.decisions.map(
    (decision) => `- ${decision.label}: ${decision.reply}`,
  );
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
