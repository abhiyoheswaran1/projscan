import { prioritizeStartHarnessHints } from './startHarness.js';
import { isRunnableCommand, uniqueStrings } from './startResume.js';
import {
  actionFromWorkplan,
  isPreflightAction,
  preflightModeForMission,
} from './startSuccessCriteria.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { SessionCoordinationHint } from '../types/session.js';
import type { WorkplanMode, WorkplanReport } from '../types/workplan.js';

export function missionGuardrails(
  mode: WorkplanMode,
  coordinationHints: SessionCoordinationHint[],
  primaryAction: PreflightSuggestedAction,
): PreflightSuggestedAction[] {
  const preflightMode = preflightModeForMission(mode);
  const guardrails: PreflightSuggestedAction[] = [
    {
      label: 'Verify the repo map before handoff',
      command: 'projscan understand --view verify --format json',
      tool: 'projscan_understand',
    },
  ];
  if (!isPreflightAction(primaryAction)) {
    guardrails.unshift({
      label: 'Check the safety gate before editing',
      command: `projscan preflight --mode ${preflightMode} --format json`,
      tool: 'projscan_preflight',
    });
  }
  for (const hint of prioritizeStartHarnessHints(coordinationHints)) {
    guardrails.push({
      label: hint.label,
      command: hint.command,
    });
  }
  return dedupeActions(guardrails).slice(0, 4);
}

export function missionProofCommands(
  mode: WorkplanMode,
  workplan: WorkplanReport,
  guardrails: PreflightSuggestedAction[],
  actionPlan: PreflightSuggestedAction[],
): string[] {
  const primaryAction = actionPlan[0] ?? actionFromWorkplan(workplan);
  const commands = uniqueStrings([
    ...actionPlan.map((action) => action.command ?? ''),
    ...(isPreflightAction(primaryAction)
      ? []
      : [`projscan preflight --mode ${preflightModeForMission(mode)} --format json`]),
    ...guardrails
      .map((action) => action.command)
      .filter((command): command is string => typeof command === 'string'),
    ...workplan.tasks.flatMap((task) => task.verification.commands),
  ]).filter(isRunnableCommand);
  const proofCommands = releaseCandidateProofCommands(mode, commands);
  if (!isPreflightAction(primaryAction)) return proofCommands.slice(0, 8);
  return proofCommands
    .filter((command, index) => index === 0 || !command.startsWith('projscan preflight '))
    .slice(0, 8);
}

export function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const result: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = action.command
      ? `command:${action.command}`
      : `action:${action.label}:${action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result.slice(0, 12);
}

function releaseCandidateProofCommands(mode: WorkplanMode, commands: string[]): string[] {
  if (mode !== 'release') return commands;
  const localWebsitePrompt = 'projscan evidence-pack --website-prompt --format json';
  const localOnly = commands.filter(
    (command) =>
      command !== 'npm view projscan version' &&
      command !== 'gh release view vX.Y.Z --json assets',
  );
  const withWebsitePrompt = localOnly.includes(localWebsitePrompt)
    ? localOnly
    : [...localOnly, localWebsitePrompt];
  const priority = [
    'projscan release-train --format json',
    'projscan preflight --mode before_merge --format json',
    'projscan understand --view verify --format json',
    'npm exec agentloop -- status',
    'npm exec agentflight -- verify',
    'npm run release:check',
    localWebsitePrompt,
  ];
  return uniqueStrings([
    ...priority.filter((command) => withWebsitePrompt.includes(command)),
    ...withWebsitePrompt,
  ]);
}
